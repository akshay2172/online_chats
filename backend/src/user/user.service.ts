import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  private users: string[] = [];
  
  addUser(username: string) {
    this.users.push(username);
  }

  removeUser(username: string) {
    this.users = this.users.filter(u => u !== username);
  }

  getUsers() {
    return this.users;
  }
}
