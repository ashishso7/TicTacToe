// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TicTacToe
/// @notice Two-player tic-tac-toe with equal USDC wagers and automatic settlement.
/// @dev On Arc Testnet, native USDC pays transaction gas independently of these ERC-20
/// wagers. Use USDC's ERC-20 address 0x3600000000000000000000000000000000000000.
/// Stakes are in USDC base units (6 decimals); approve this contract before creating
/// or joining a game. Only the standard, non-fee-on-transfer USDC token is supported.
/// Failed settlement payouts accrue as credits without reverting settlement; recipients
/// may withdraw their credits once USDC transfers to them are permitted.
contract TicTacToe is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status { Open, Active, Won, Draw, Cancelled, TimedOut }

    /// @notice Board cells are 0 (empty), 1 (X), or 2 (O), in row-major order.
    /// @dev nextTurn is zero after settlement. winner is zero unless Won or TimedOut.
    struct Game {
        address playerX;
        address playerO;
        uint256 stake;
        uint8[9] board;
        address nextTurn;
        Status status;
        address winner;
        uint64 lastMoveAt;
    }

    /// @notice Token used for wagers, distinct from native gas accounting.
    IERC20 public immutable usdc;
    /// @notice Maximum turn duration before the waiting player may claim.
    uint256 public constant TURN_TIMEOUT = 5 minutes;
    /// @notice Next available game ID; IDs start at 1 and are never reused.
    uint256 public nextGameId = 1;
    /// @notice Enumerate IDs from 1 to gameCount(); use getGame to include the board.
    mapping(uint256 => Game) public games;
    /// @notice Failed settlement payouts owed to each recipient in USDC base units.
    mapping(address => uint256) public credits;

    /// @notice The supplied token address is zero.
    error ZeroAddress();
    /// @notice Stake must be positive and its doubled value must fit uint256.
    error InvalidStake();
    /// @notice No game exists at the supplied ID.
    error GameNotFound(uint256 id);
    /// @notice The game is not in the required state.
    error InvalidStatus(Status actual, Status expected);
    /// @notice The caller is not authorized for this action.
    error Unauthorized();
    /// @notice A creator cannot join their own game.
    error SelfPlay();
    /// @notice The requested board index is outside 0 through 8.
    error InvalidCell(uint8 cell);
    /// @notice The requested board cell is already occupied.
    error CellOccupied(uint8 cell);
    /// @notice The current turn has not yet exceeded its deadline.
    error TimeoutNotReached(uint256 deadline);
    /// @notice The caller has no credit to withdraw.
    error NoCredit();

    /// @notice A creator deposited a stake and opened a game.
    event GameCreated(uint256 indexed id, address indexed creator, uint256 stake);
    /// @notice A second player deposited the matching stake; X moves first.
    event GameJoined(uint256 indexed id, address indexed playerO);
    /// @notice A player marked a cell.
    event MoveMade(uint256 indexed id, address indexed player, uint8 cell);
    /// @notice A game settled; winner is zero for a draw or cancellation.
    event GameFinished(uint256 indexed id, Status status, address indexed winner);
    /// @notice A failed settlement payout was added to the recipient's credit.
    event PayoutCredited(address indexed to, uint256 amount);
    /// @notice A recipient successfully withdrew their accumulated credit.
    event CreditWithdrawn(address indexed to, uint256 amount);

    /// @param usdc_ USDC ERC-20 address, not the native-token sentinel address.
    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
    }

    /// @notice Open a game and escrow one stake using an existing allowance.
    /// @param stake Amount in USDC base units (1 USDC = 1_000_000).
    /// @return id Newly created game ID.
    function createGame(uint256 stake) external nonReentrant returns (uint256 id) {
        if (stake == 0 || stake > type(uint256).max / 2) revert InvalidStake();
        id = nextGameId++;
        Game storage game = games[id];
        game.playerX = msg.sender;
        game.stake = stake;
        game.status = Status.Open;
        usdc.safeTransferFrom(msg.sender, address(this), stake);
        emit GameCreated(id, msg.sender, stake);
    }

    /// @notice Join an open game, escrow its matching stake, and start X's turn.
    /// @param id Existing game ID.
    function joinGame(uint256 id) external nonReentrant {
        Game storage game = _game(id);
        _requireStatus(game, Status.Open);
        if (msg.sender == game.playerX) revert SelfPlay();
        game.playerO = msg.sender;
        game.nextTurn = game.playerX;
        game.status = Status.Active;
        game.lastMoveAt = uint64(block.timestamp);
        usdc.safeTransferFrom(msg.sender, address(this), game.stake);
        emit GameJoined(id, msg.sender);
    }

    /// @notice Cancel your unjoined game and recover the stake.
    /// @param id Existing open game ID.
    function cancelGame(uint256 id) external nonReentrant {
        Game storage game = _game(id);
        _requireStatus(game, Status.Open);
        if (msg.sender != game.playerX) revert Unauthorized();
        game.status = Status.Cancelled;
        _payout(game.playerX, game.stake);
        emit GameFinished(id, Status.Cancelled, address(0));
    }

    /// @notice Mark an empty cell on your turn and settle any win or draw.
    /// @dev A late move remains valid until the waiting player claims the timeout.
    /// @param id Existing active game ID.
    /// @param cell Row-major board index, from 0 through 8.
    function play(uint256 id, uint8 cell) external nonReentrant {
        Game storage game = _game(id);
        _requireStatus(game, Status.Active);
        if (msg.sender != game.nextTurn) revert Unauthorized();
        if (cell >= 9) revert InvalidCell(cell);
        if (game.board[cell] != 0) revert CellOccupied(cell);

        uint8 mark = msg.sender == game.playerX ? 1 : 2;
        game.board[cell] = mark;
        game.lastMoveAt = uint64(block.timestamp);
        emit MoveMade(id, msg.sender, cell);

        if (_hasWon(game.board, mark)) {
            game.status = Status.Won;
            game.winner = msg.sender;
            game.nextTurn = address(0);
            _payout(msg.sender, game.stake * 2);
            emit GameFinished(id, Status.Won, msg.sender);
        } else if (_isFull(game.board)) {
            game.status = Status.Draw;
            game.nextTurn = address(0);
            _payout(game.playerX, game.stake);
            _payout(game.playerO, game.stake);
            emit GameFinished(id, Status.Draw, address(0));
        } else {
            game.nextTurn = mark == 1 ? game.playerO : game.playerX;
        }
    }

    /// @notice Claim the full pot when your opponent's turn exceeds five minutes.
    /// @param id Existing active game ID.
    function claimTimeout(uint256 id) external nonReentrant {
        Game storage game = _game(id);
        _requireStatus(game, Status.Active);
        address waitingPlayer = game.nextTurn == game.playerX ? game.playerO : game.playerX;
        if (msg.sender != waitingPlayer) revert Unauthorized();
        uint256 deadline = uint256(game.lastMoveAt) + TURN_TIMEOUT;
        if (block.timestamp <= deadline) revert TimeoutNotReached(deadline);

        game.status = Status.TimedOut;
        game.winner = msg.sender;
        game.nextTurn = address(0);
        _payout(msg.sender, game.stake * 2);
        emit GameFinished(id, Status.TimedOut, msg.sender);
    }

    /// @notice Withdraw all your accumulated credit to your own address.
    /// @dev Reverts with NoCredit if none is owed. A failed USDC transfer reverts
    /// the withdrawal and restores the credit, leaving settled games unchanged.
    function withdrawCredit() external nonReentrant {
        uint256 amount = credits[msg.sender];
        if (amount == 0) revert NoCredit();
        credits[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit CreditWithdrawn(msg.sender, amount);
    }

    /// @notice Return all game data, including its nine board cells.
    /// @param id Existing game ID; reverts if it does not exist.
    /// @return game Full game snapshot.
    function getGame(uint256 id) external view returns (Game memory game) {
        return _game(id);
    }

    /// @notice Number of games ever created, including settled games.
    function gameCount() external view returns (uint256) {
        return nextGameId - 1;
    }

    /// @dev Attempt a payout after game state is finalized; credit failures instead
    /// of reverting settlement or preventing another recipient's payout.
    function _payout(address to, uint256 amount) internal {
        if (!usdc.trySafeTransfer(to, amount)) {
            credits[to] += amount;
            emit PayoutCredited(to, amount);
        }
    }

    /// @dev Resolve a valid game; default mapping entries are not open games.
    function _game(uint256 id) private view returns (Game storage game) {
        if (id == 0 || id >= nextGameId) revert GameNotFound(id);
        return games[id];
    }

    /// @dev Enforce the required lifecycle state before any effects.
    function _requireStatus(Game storage game, Status expected) private view {
        if (game.status != expected) revert InvalidStatus(game.status, expected);
    }

    /// @dev Check the three rows, three columns, and two diagonals.
    function _hasWon(uint8[9] storage board, uint8 mark) private view returns (bool) {
        for (uint256 i; i < 3; ++i) {
            uint256 row = i * 3;
            if (board[row] == mark && board[row + 1] == mark && board[row + 2] == mark) {
                return true;
            }
            if (board[i] == mark && board[i + 3] == mark && board[i + 6] == mark) {
                return true;
            }
        }
        return (board[0] == mark && board[4] == mark && board[8] == mark)
            || (board[2] == mark && board[4] == mark && board[6] == mark);
    }

    /// @dev At most nine cells are inspected; no move-history storage is needed.
    function _isFull(uint8[9] storage board) private view returns (bool) {
        for (uint256 i; i < 9; ++i) {
            if (board[i] == 0) return false;
        }
        return true;
    }
}
