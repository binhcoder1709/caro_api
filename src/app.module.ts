import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {AppGateway} from "./app.gateway";
import Redis from "ioredis";

@Module({
    imports: [],
    controllers: [AppController],
    providers: [AppService, AppGateway, {
        provide: 'REDIS_CLIENT',
        useFactory: () => {
            return new Redis({
                host: 'localhost',
                port: 6379
            })
        }
    }],
})
export class AppModule {
}
