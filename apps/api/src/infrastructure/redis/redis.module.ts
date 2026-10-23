import { Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import IORedis from 'ioredis';
import type { Redis } from 'ioredis';
import { parseEnvironment } from '@codeguard/config';
import { REDIS } from './redis.constants';

class RedisLifecycle implements OnModuleInit, OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleInit(): Promise<void> {
    await this.redis.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status !== 'end') await this.redis.quit();
  }
}

@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (): Redis => {
        const env = parseEnvironment(process.env);
        return new IORedis(env.REDIS_URL, {
          enableOfflineQueue: false,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        });
      },
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}
