import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

const USER = /^[A-Za-z0-9_]{1,50}$/;
const ROOM = /^[A-Za-z0-9_-]{1,80}$/;
const ID = /^[A-Za-z0-9_-]{1,128}$/;

export class FileDataDto {
  @IsString() @MaxLength(255) filename: string;
  @IsString() @MaxLength(255) originalName: string;
  @IsString() @MaxLength(100) mimetype: string;
  @IsNumber() @Min(0) @Max(10 * 1024 * 1024) size: number;
  @IsString() @MaxLength(2048) url: string;
  @IsOptional() @IsString() @MaxLength(14 * 1024 * 1024) base64?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(10000) width?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10000) height?: number;
  @IsOptional() @IsString() @MaxLength(2048) preview?: string;
}
export class GifDataDto { @IsOptional() @IsNumber() @Min(0) @Max(10000) width?: number; @IsOptional() @IsNumber() @Min(0) @Max(10000) height?: number; @IsOptional() @IsString() @MaxLength(2048) preview?: string; }
export class SearchFiltersDto { @IsOptional() @IsString() @MaxLength(50) from?: string; @IsOptional() @IsString() @MaxLength(100) has?: string; @IsOptional() @IsString() @MaxLength(40) before?: string; @IsOptional() @IsString() @MaxLength(40) after?: string; @IsOptional() @IsString() @MaxLength(50) mentions?: string; }
export class ProfileUpdatesDto { @IsOptional() @IsString() @MaxLength(100) displayName?: string; @IsOptional() @IsString() @MaxLength(500) bio?: string; @IsOptional() @IsString() @MaxLength(2048) avatar?: string; @IsOptional() @IsString() @MaxLength(2048) coverPhoto?: string; }

export class RoomDto { @IsString() @IsNotEmpty() @MaxLength(80) @Matches(ROOM) room: string; }
export class UsernameDto { @IsString() @IsNotEmpty() @MaxLength(50) @Matches(USER) username: string; }
export class ConversationDto { @IsString() @IsNotEmpty() @MaxLength(128) @Matches(ID) conversationId: string; }
export class MessageRefDto { @IsString() @IsNotEmpty() @MaxLength(128) @Matches(ID) messageId: string; }
export class JoinRoomDto { @IsString() @IsNotEmpty() @MaxLength(80) @Matches(ROOM) room: string; @IsOptional() @IsString() @MaxLength(50) @Matches(USER) username?: string; @IsOptional() @IsString() @MaxLength(50) country?: string; @IsOptional() @IsEnum(['male','female','other']) gender?: 'male'|'female'|'other'; @IsOptional() @IsString() @MaxLength(100) displayName?: string; @IsOptional() @IsString() @MaxLength(2048) avatar?: string; }
export class RoomInfoDto extends RoomDto {}
export class RoomIdDto { @IsString() @IsNotEmpty() @MaxLength(128) @Matches(ID) roomId: string; }
export class SendMessageDto extends RoomDto { @IsString() @IsNotEmpty() @MaxLength(10000) message: string; @IsOptional() @IsString() @MaxLength(30) messageType?: string; @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(50, { each: true }) mentions?: string[]; @IsOptional() @IsString() @MaxLength(128) @Matches(ID) replyTo?: string; }
export class SendGifDto extends RoomDto { @IsString() @IsNotEmpty() @MaxLength(2048) gifUrl: string; @IsOptional() @ValidateNested() @Type(() => GifDataDto) gifData?: GifDataDto; @IsOptional() @IsString() @MaxLength(128) @Matches(ID) replyTo?: string; }
export class EditMessageDto extends RoomDto { @IsString() @IsNotEmpty() @MaxLength(128) @Matches(ID) messageId: string; @IsString() @IsNotEmpty() @MaxLength(10000) newMessage: string; }
export class RoomMessageDto extends RoomDto { @IsString() @IsNotEmpty() @MaxLength(128) @Matches(ID) messageId: string; }
export class ReactMessageDto extends RoomMessageDto { @IsString() @MaxLength(10) emoji: string; @IsString() @MaxLength(50) @Matches(USER) username: string; @IsEnum(['add','remove']) action: 'add'|'remove'; }
export class MarkAsReadDto extends RoomMessageDto { @IsString() @MaxLength(50) @Matches(USER) username: string; }
export class MarkRoomAsReadDto extends RoomDto { @IsString() @MaxLength(50) @Matches(USER) username: string; }
export class SearchMessagesDto extends RoomDto { @IsString() @IsNotEmpty() @MaxLength(500) query: string; @IsOptional() @ValidateNested() @Type(() => SearchFiltersDto) filters?: SearchFiltersDto; }
export class UploadFileDto extends RoomDto { @IsString() @MaxLength(50) @Matches(USER) username: string; @ValidateNested() @Type(() => FileDataDto) fileData: FileDataDto; }
export class ReportMessageDto extends RoomMessageDto { @IsString() @MaxLength(50) @Matches(USER) reportedBy: string; @IsOptional() @IsString() @MaxLength(1000) reason?: string; }
export class TypingDto extends RoomDto { @IsBoolean() isTyping: boolean; }
export class DmTypingDto extends ConversationDto { @IsString() @IsNotEmpty() @MaxLength(50) @Matches(USER) receiverUsername: string; @IsBoolean() isTyping: boolean; }
export class UpdateProfileDto extends UsernameDto { @ValidateNested() @Type(() => ProfileUpdatesDto) updates: ProfileUpdatesDto; }
export class CreateRoomDto { @IsString() @IsNotEmpty() @MaxLength(80) @Matches(ROOM) name: string; @IsOptional() @IsString() @MaxLength(500) description?: string; @IsEnum(['public','private']) type: 'public'|'private'; }
export class JoinRoomByIdDto extends RoomIdDto { @IsOptional() @IsString() @MaxLength(100) displayName?: string; @IsOptional() @IsString() @MaxLength(50) country?: string; @IsOptional() @IsEnum(['male','female','other']) gender?: 'male'|'female'|'other'; @IsOptional() @IsString() @MaxLength(2048) avatar?: string; }
export class TargetUserDto { @IsString() @IsNotEmpty() @MaxLength(50) @Matches(USER) usernameToBlock: string; }
export class TargetUnblockUserDto { @IsString() @IsNotEmpty() @MaxLength(50) @Matches(USER) usernameToUnblock: string; }
export class ReportUserDto { @IsString() @MaxLength(50) @Matches(USER) usernameToReport: string; @IsOptional() @IsString() @MaxLength(1000) reason?: string; }
export class InviteUserDto { @IsString() @MaxLength(50) @Matches(USER) targetUsername: string; @IsString() @MaxLength(128) @Matches(ID) roomId: string; }
export class DeleteRoomDto { @IsString() @MaxLength(128) @Matches(ID) roomId: string; @IsString() @MaxLength(50) @Matches(USER) username: string; }
export class ModerationDto extends RoomDto { @IsString() @MaxLength(50) @Matches(USER) username: string; @IsOptional() @IsString() @MaxLength(1000) reason?: string; @IsOptional() @IsInt() @Min(0) @Max(31536000) duration?: number; }
export class BanUserDto extends ModerationDto {}
export class PromoteUserDto extends RoomDto { @IsString() @MaxLength(50) @Matches(USER) username: string; @IsEnum(['admin','moderator','member']) role: 'admin'|'moderator'|'member'; }
export class StartDmDto { @IsString() @MaxLength(50) @Matches(USER) targetUsername: string; @IsOptional() @IsString() @MaxLength(50) @Matches(USER) username?: string; }
export class SendDmMessageDto extends ConversationDto { @IsString() @IsNotEmpty() @MaxLength(10000) message: string; @IsString() @MaxLength(50) @Matches(USER) receiver: string; @IsOptional() @IsString() @MaxLength(50) @Matches(USER) username?: string; @IsOptional() @IsString() @MaxLength(30) messageType?: string; @IsOptional() @ValidateNested() @Type(() => FileDataDto) fileData?: FileDataDto; @IsOptional() @IsString() @MaxLength(128) @Matches(ID) replyTo?: string; }
export class LoadDmMessagesDto extends ConversationDto { @IsOptional() @IsInt() @Min(0) @Max(100000) skip?: number; }
export class DmMessageRefDto extends ConversationDto { @IsString() @MaxLength(128) @Matches(ID) messageId: string; }
export class ReactDmDto extends DmMessageRefDto { @IsString() @MaxLength(10) emoji: string; @IsEnum(['add','remove']) action: 'add'|'remove'; }
export class EditDmDto extends DmMessageRefDto { @IsString() @IsNotEmpty() @MaxLength(10000) newMessage: string; }
export class SendDmGifDto extends ConversationDto { @IsString() @MaxLength(50) @Matches(USER) receiver: string; @IsString() @IsNotEmpty() @MaxLength(2048) gifUrl: string; @IsOptional() @ValidateNested() @Type(() => GifDataDto) gifData?: GifDataDto; }
export class UploadDmFileDto extends ConversationDto { @IsString() @MaxLength(50) @Matches(USER) receiver: string; @ValidateNested() @Type(() => FileDataDto) fileData: FileDataDto; }
export class UserProfileDto { @IsString() @MaxLength(50) @Matches(USER) username: string; }
export class ImageUploadDto { @IsString() @IsNotEmpty() @MaxLength(14 * 1024 * 1024) imageData: string; @IsString() @MaxLength(255) filename: string; }
export class FriendRequestDto { @IsString() @MaxLength(50) @Matches(USER) targetUsername: string; }
export class RespondFriendRequestDto { @IsString() @MaxLength(128) @Matches(ID) requestId: string; @IsEnum(['accept','reject']) action: 'accept'|'reject'; }
export class RemoveFriendDto { @IsString() @MaxLength(50) @Matches(USER) friendUsername: string; }

export class PlatformBanDto extends UsernameDto { @IsOptional() @IsString() @MaxLength(1000) reason?: string; }

