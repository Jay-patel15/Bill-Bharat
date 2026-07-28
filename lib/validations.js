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
  termsAndConditions: z.union([z.string(), z.record(z.any())]).optional().nullable(),
  invoiceTemplate: z.union([z.string(), z.record(z.any())]).optional().nullable(),
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
  creditLimit: z.number().nonnegative().optional().default(0),
  outstanding: z.number().optional().default(0)
});

/**
 * Inventory Item Schema
 */
export const inventorySchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  name: z.string().trim().min(1, "Item name is required"),
  sku: z.string().optional().nullable(),
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
  discount: z.number().nonnegative().optional().default(0)
});

/**
 * Sale / Invoice Schema
 */
export const saleSchema = z.object({
  companyId: z.string().optional().nullable(),
  customerId: z.string().min(1, "Customer ID is required"),
  projectId: z.string().optional().nullable(),
  projectName: z.string().optional().nullable(),
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
  name: z.string().min(1, "Item name required"),
  hsnCode: z.string().optional().nullable(),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().optional().nullable(),
  rate: z.number().nonnegative("Rate cannot be negative"),
  gstRate: z.number().nonnegative().optional().default(0)
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
 * Project Schema
 */
export const projectSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  customerId: z.string().optional().nullable(),
  name: z.string().trim().min(1, "Project name is required"),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  boqItems: z.array(z.any()).optional().default([]),
  contractValue: z.number().nonnegative().optional().default(0),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.string().optional().default("active"),
  notes: z.string().optional().nullable()
});

/**
 * Payment Schema
 */
export const paymentSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  type: z.enum(["in", "out"], { errorMap: () => ({ message: "Type must be 'in' or 'out'" }) }),
  refId: z.string().optional().nullable(),
  amount: z.number().positive("Payment amount must be greater than zero"),
  method: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

/**
 * Product Mapping Schema
 */
export const productMappingSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  realName: z.string().trim().min(1, "Real name required"),
  systemName: z.string().trim().min(1, "System name required")
});

/**
 * Journal Entry Line Schema
 */
export const journalLineSchema = z.object({
  account: z.string().min(1, "Account name required"),
  debit: z.number().nonnegative().optional().default(0),
  credit: z.number().nonnegative().optional().default(0)
});

/**
 * Journal Entry Schema
 */
export const journalEntrySchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional().nullable(),
  entries: z.array(journalLineSchema).min(1, "At least one entry required")
});

/**
 * Auth Forgot Password Schema
 */
export const authForgotSchema = z.object({
  email: z.string().email("Valid email address is required")
});

/**
 * Auth Reset Password Schema
 */
export const authResetSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

/**
 * Expense / Income Day Book Entry Schema (Rojmel Jama/Udhar & Site Entries)
 */
export const expenseEntrySchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  date: z.string().min(1, "Date is required"),
  entryType: z.enum(["IN", "OUT"]).optional().default("OUT"),
  category: z.string().min(1, "Category is required"),
  amount: z.number().positive("Amount must be greater than zero"),
  paymentMode: z.string().optional().default("Cash"),
  projectId: z.string().optional().nullable(),
  projectName: z.string().optional().nullable(),
  description: z.string().optional().nullable()
});


