import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

// Kept in sync with the CATEGORIES list in prisma/seed.ts.
export const KNOWN_CATEGORIES = [
  "Electronics",
  "Home & Kitchen",
  "Sports & Outdoors",
  "Books",
  "Toys & Games",
  "Beauty & Personal Care",
  "Clothing",
  "Shoes",
  "Grocery",
  "Office Supplies",
  "Pet Supplies",
  "Automotive",
  "Garden & Outdoor",
  "Health & Household",
  "Jewelry",
] as const;

export class GetProductsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsIn(KNOWN_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
