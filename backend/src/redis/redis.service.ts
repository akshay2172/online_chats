import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';  
import { createClient, RedisClientType } from 'redis';  
  
@Injectable()  
export class RedisService implements OnModuleInit, OnModuleDestroy {  
  private client: RedisClientType;  
  
  async onModuleInit() {  
    this.client = createClient({  
      url: process.env.REDIS_URL || 'redis://localhost:6379',  
    });  
    this.client.on('error', (err) => console.error('Redis error:', err));  
    await this.client.connect();  
    console.log('✅ Redis connected');  
  }  
  
  async onModuleDestroy() {  
    await this.client.quit();  
  }  
  
  getClient(): RedisClientType {  
    return this.client;  
  }  
}