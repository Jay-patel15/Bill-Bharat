import { z } from "zod";

/**
 * Company Schema
 */
export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  logoUrl: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  stateCode: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  panNumber: z.string().optional().nullable(),
  bankAccountNo: z.string().optional().nullable(),
  bankIfsc: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankBranch: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")).nullable()
});

/**
 * Customer Schema
 */
export const customerSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  name: z.string().trim().min(1, "Customer name is required"),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")).nullable(),
  address: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  stateCode: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  creditLimit: z.number().nonnegative().optional().default(0)
});

/**
 * Inventory Item Schema
 */
export const inventorySchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  name: z.string().trim().min(1, "Item name is required"),
  sku: z.string().optional().nullable(),
  barcode: z.string().trim().optional().nullable(),
  category: z.string().optional().nullable(),
  purchasePrice: z.number().nonnegative("Purchase price cannot be negative").optional().default(0),
  sellingPrice: z.number().nonnegative("Selling price cannot be negative").optional().default(0),
  gstRate: z.number().nonnegative("GST rate cannot be negative").optional().default(0),
  quantity: z.number().optional().default(0),
  lowStockThreshold: z.number().nonnegative().optional().default(0),
  unit: z.string().optional().nullable(),
  hsnCode: z.string().optional().nullable()
});

/**
 * Sale Item Line Schema
 */
export const saleItemSchema = z.object({
  inventoryId: z.string().optional().nullable(),
  name: z.string().min(1, "Item name required"),
  hsnCode: z.string().optional().nullable(),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().optional().nullable(),
  rate: z.number().nonnegative().optional().nullable(),
  sellingPrice: z.number().nonnegative().optional().nullable(),
  gstRate: z.number().nonnegative().optional().default(0),
  discount: z.number().nonnegative().optional().default(0),
  consumablesUsed: z.array(z.object({
    inventoryId: z.string().min(1, "Pick each consumable from the stock list"),
    quantity: z.number().positive("Consumable quantity must be positive")
  })).optional().default([])
});

/**
 * Sale / Invoice Schema
 */
export const saleSchema = z.object({
  companyId: z.string().optional().nullable(),
  customerId: z.string().min(1, "Customer ID is required"),
  documentType: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1, "At least one item is required"),
  discount: z.number().nonnegative().optional().default(0),
  amountPaid: z.number().nonnegative().optional().default(0),
  status: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

/**
 * Purchase Line Schema
 */
export const purchaseItemSchema = z.object({
  inventoryId: z.string().optional().nullable(),
  name: z.string().min(1, "Item name required"),
  sku: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  realName: z.string().optional().nullable(),
  hsnCode: z.string().optional().nullable(),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().optional().nullable(),
  rate: z.number().nonnegative().optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  gstRate: z.number().nonnegative().optional().default(0),
  discount: z.number().nonnegative().optional().default(0)
});

/**
 * Purchase Schema
 */
export const purchaseSchema = z.object({
  companyId: z.string().optional().nullable(),
  supplierName: z.string().min(1, "Supplier name required"),
  supplierGst: z.string().optional().nullable(),
  billNumber: z.string().optional().nullable(),
  billDate: z.string().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, "At least one purchase item is required"),
  discount: z.number().nonnegative().optional().default(0),
  amountPaid: z.number().nonnegative().optional().default(0),
  status: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});


/**
 * Product Mapping Schema
 */
export const productMappingSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  realName: z.string().trim().min(1, "Real name required"),
  systemName: z.string().trim().optional().nullable()
});
