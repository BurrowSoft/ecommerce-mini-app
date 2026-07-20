import { IsOptional, IsString } from 'class-validator';

export class SuggestQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}
