// Kept in sync with backend/prisma/seed.ts and
// backend/src/catalog/dto/get-products-query.dto.ts. No "list categories"
// endpoint exists (out of spec scope), so this is duplicated rather than
// fetched — a small, deliberate trade-off noted in the README.
export const CATEGORIES = [
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
