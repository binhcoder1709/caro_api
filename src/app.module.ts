import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {AppGateway} from "./app.gateway";
import Redis from "ioredis";
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule.forRoot({envFilePath: '.env', isGlobal: true})],
    controllers: [AppController],
    providers: [AppService, AppGateway, {
        provide: 'REDIS_CLIENT',
        useFactory: () => {
            return new Redis({
                host: process.env.REDIS_HOST,
                port: 6379
            })
        }
    }],
})
export class AppModule {
}
