import {ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer} from "@nestjs/websockets";
import {Server, Socket} from 'socket.io'
import Redis from "ioredis";
import {Inject} from "@nestjs/common";
import {uuid} from 'uuidv4'
import {Room} from "./interfaces/room";

@WebSocketGateway(3001)
export class AppGateway {
    constructor(@Inject("REDIS_CLIENT") private readonly redisClient: Redis) {
    }

    @WebSocketServer() server: Server;

    @SubscribeMessage('createRoom')
    async handleCreateRoom(@ConnectedSocket() client: Socket) {
        const roomId = `ticTacToeRoom-${uuid()}`
        const room = await this.redisClient.get(roomId)
        if (room) {
            client.emit('error', 'Phòng đã tồn tại');
            return;
        }
        const roomData = {
            players: [client.id],
            board: Array(3).fill(null).map(() => Array(3).fill(null)),
            currentPlayer: client.id,
        };
        await this.redisClient.set(roomId, JSON.stringify(roomData));
        client.join(roomId);
        client.emit('roomCreated', roomId);
    }

    @SubscribeMessage('joinRoom')
    async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
        const room = await this.redisClient.get(roomId)
        const roomJson: Room = room ? JSON.parse(room as string) : null;
        if (room === null) {
            client.emit('error', 'Phòng không tồn tại');
            return;
        }
        if (roomJson.players.length >= 2) {
            client.emit('error', 'Phòng đã đầy');
            return;
        }
        roomJson.players.push(client.id);
        await this.redisClient.set(roomId, JSON.stringify(roomJson));
        client.join(roomId);
        this.server.to(roomId).emit('playerJoined', roomId);
    }

    @SubscribeMessage('playTurn')
    async handlePlayTurn(@ConnectedSocket() client: Socket, @MessageBody() data: {
        roomId: string;
        row: number;
        col: number
    }) {
        const room = await this.redisClient.get(data.roomId)
        const roomJson: Room = room ? JSON.parse(room as string) : null;
        if (!room) {
            client.emit('error', 'Phòng không tồn tại');
            return;
        }

        const {board, currentPlayer} = roomJson;
        if (currentPlayer !== client.id || board[data.row][data.col] !== null) {
            client.emit('error', 'Lượt chơi không hợp lệ');
            return;
        }

        board[data.row][data.col] = client.id === roomJson.players[0] ? 'X' : 'O';
        roomJson.currentPlayer = roomJson.players.find((id) => id !== client.id);

        this.server.to(data.roomId).emit('boardUpdated', board);

        if (this.checkWinner(board)) {
            this.server.to(data.roomId).emit('gameOver', {winner: client.id});
            await this.redisClient.del(data.roomId);
        } else if (board.every((row) => row.every((cell) => cell !== null))) {
            this.server.to(data.roomId).emit('gameOver', {winner: 'draw'});
            await this.redisClient.del(data.roomId)
        }
    }

    private checkWinner(board: string[][]): boolean {
        const lines = [
            [board[0][0], board[0][1], board[0][2]],
            [board[1][0], board[1][1], board[1][2]],
            [board[2][0], board[2][1], board[2][2]],
            [board[0][0], board[1][0], board[2][0]],
            [board[0][1], board[1][1], board[2][1]],
            [board[0][2], board[1][2], board[2][2]],
            [board[0][0], board[1][1], board[2][2]],
            [board[0][2], board[1][1], board[2][0]],
        ];
        return lines.some((line) => line.every((cell) => cell && cell === line[0]));
    }
}