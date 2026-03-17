import { Global, Module } from '@nestjs/common';  
import { RedisService } from './redis.service';  
  
@Global() // Makes it available everywhere without importing in each module  
@Module({  
  providers: [RedisService],  
  exports: [RedisService],  
})  
export class RedisModule {}