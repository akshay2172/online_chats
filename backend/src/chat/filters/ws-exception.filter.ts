import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(WsException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: WsException | any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const error = exception.getError();
    let message = 'Invalid request payload';

    if (typeof error === 'string') {
      message = error;
    } else if (typeof error === 'object' && error !== null) {
      if (typeof (error as any).message === 'string') {
        message = (error as any).message;
      } else if (Array.isArray((error as any).message)) {
        message = (error as any).message.join(', ');
      }
    }

    client.emit('error', { message });
  }
}
