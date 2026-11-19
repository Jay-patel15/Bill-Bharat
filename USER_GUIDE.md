# BillBharat — Simple User Guide

BillBharat is a billing app for your business. It makes GST invoices, keeps your stock, and tracks what customers owe you and what you owe suppliers. Everything stays on your own computer. You do not need internet to use it.

---

## 1. What the app can do

- **GST invoices:** Tax Invoice, Quotation, Proforma, Purchase Order and Delivery Challan, with CGST+SGST or IGST chosen by state.
- **Invoice print:** a full A4 GST invoice with your logo, bank details, terms and signature area. Long bills continue on the next page.
- **Customers and items:** keep your customers, and your products with price, GST rate and unit.
- **Stock:** sales take stock out, purchases put it in. Negative stock is shown in red.
- **Electrical work with parts:** bill one amount for the work while the parts come out of stock.
- **Purchases:** record supplier bills by hand, or let the AI reader fill one in from a photo or PDF (optional).
- **Payments:** part or full payments on invoices and bills. The status updates by itself.
- **Edit an unpaid invoice** and **send an invoice** by WhatsApp or email.
- **Reports:** Sales, GST, outstanding dues, party ledger (with a PDF per bill or combined), audit log, Excel stock report.
- **Several companies** in one app.
- **Backups:** automatic, plus copies to a folder you choose.

---

## 2. Start

1. Open BillBharat and **sign up**.
2. **Write down the recovery code** it shows. It is the only way back in if you forget your password. Keep it safe. To get a new one, go to **Settings → Recovery code**. The old code stops working.
3. **Create your company:** name, GST number, address, phone and bank details. The first two digits of the GST number set your state, which decides CGST+SGST or IGST. If your business does not have a GST number, leave it blank. Your invoices then print without GST.
4. Open **Settings** to check your terms, logo and invoice layout.
5. Add your customers and items. You can also add them while billing.

---

## 3. Make an invoice

1. Press **F8** (or open **Sales → New**).
2. Pick the type: Tax Invoice, Quotation, Proforma, Purchase Order or Delivery Challan.
3. Pick the customer, add items, and check the total.
4. Press **Save**. The invoice number is filled in for you.

Saving a sale takes stock out. Deleting the sale puts it back.

**Items:** type an item name in the last row and a new row opens under it. To add a row above or below another row, press the **↑** or **↓** button on that row.

**Print:** open the invoice and press **Print**, or press **Ctrl+P**. The invoice goes straight to the printer.

---

## 4. Record money received

- Open the invoice and type the amount in **Record payment**, then press **Record Payment**.
- If the amount is **more than what is pending**, a yellow box appears. Choose:
  - **Re-edit amount** to type the right amount, or
  - **Ignore and record anyway** to save it as it is.

**Changing a payment:** under *Payment History*, press **Edit** on the payment. Its amount, method and note load into the *Record payment* box. Change them and press **Save Payment Changes**. Press **Cancel edit** to keep it as it was. Press **Delete** to remove the payment.

Paying a supplier works the same way: open the bill under **Purchases**. On the supplier's page, the **Show** box chooses *All bills combined* or one bill. The three figures at the top then show the totals for that choice. It has the same payment box and history as an invoice, and **Close bill** records the whole amount still due. From a customer's page, **Edit** on a payment opens that invoice with the payment ready to change.

---

## 5. Edit an invoice

- Open the invoice and press **Edit**. Change items, quantities, prices or dates, then save.
- You can edit an invoice **only while it is unpaid**. Once money is recorded against it, the Edit button goes away. To change it, delete its payments first.

---

## 6. Send an invoice to a customer

On the invoice, press **WhatsApp** or **Email**. The PDF goes with a short message such as:

> Dear Siddhi Electricals, your invoice generated on 27-Feb-23, Invoice No 1462/22-23, Amount 9,086.00 Dr, *your company*, Regards.

- In a browser or on a phone, the PDF is attached for you. Pick WhatsApp or Gmail.
- In the **BillBharat desktop app**, the PDF is saved to your **Downloads** folder and WhatsApp (or your mail app) opens with the message. Attach the saved PDF yourself.

---

## 7. Electrical work with parts

Use this when you bill one amount for the work, but the parts come out of your stock.

1. Go to **Inventory** and press **Enable Electrical Works consumables**. Press it again to turn it off.
2. On a Tax Invoice, pick **Electrical Works** and type the amount for the work.
3. A box opens. Pick each part from your stock and type how much you used. Press **Done**.
4. The customer sees only **Electrical Works** and the amount. The parts are **not printed**.

Parts can be added only on a Tax Invoice.

---

## 8. Stock

- Each sale takes stock out. Each purchase puts stock in.
- A red **Negative** label means you have billed more than your recorded stock. Check your purchases and stock count, then correct the item.
- **Low stock warning:** set a **Low stock threshold** on an item in Inventory (a number above 0). When its stock is at or below that number, the item appears in the **Low stock** card on the dashboard. The default is 0, which turns the warning off for that item.
- **Stock Report** downloads the list to Excel.

---

## 9. Reports

Under **Reports**:

- **Sales report** and **GST report**
- **Outstanding dues:** who owes you, and whom you owe
- **Party ledger:** the full account of one customer or supplier. When you download it for several bills, choose **PDF: combined table** (one table for all) or **PDF: table per bill** (a separate table with its own heading for each bill, in one PDF)
- **Audit log:** a record of changes

---

## 10. Settings

Open **Settings** from the left menu.

| Section | What it is for |
|---|---|
| **Company details** | Name, GST number, PAN, address, phone, email, logo and bank details. Press *Edit company details*. *All companies* lists your companies. |
| **Invoice template** | Choose what the GST invoice shows and rename its parts. You can also set the invoice number format, such as `INV/{FY}/{###}`. There is a live preview. |
| **Terms & Conditions** | One term per line. They print numbered on the invoice. |
| **Recovery code** | Makes a new recovery code and shows it once. The old code stops working. Write the new one down. |
| **Updates** | *Check for updates* looks for a newer BillBharat. If there is one, you confirm, it downloads, installs and restarts. Your books are kept. Needs internet only at that moment. The portable version cannot update itself; download the new installer. |
| **Product master names** | One name per line. The AI purchase reader uses these to match supplier item names. |
| **Gemini AI bill reader** | Optional. Paste a key from Google AI Studio to let the AI read purchase bills. The key is stored encrypted on this computer. The AI needs internet only while it reads a bill. |
| **Backup & Restore** | Back up now, pick extra backup folders (pen drive, Google Drive, OneDrive, Dropbox), and restore from a file. |
| **Reset (erase all books)** | Deletes every company and its records. It asks for your password and saves a backup first. Use it only to start again. |

---

## 11. Back and moving around

- **Back** (top left) takes you to the page you came from.
- **Esc** does the same when no box is open.
- The **company name** at the top switches between companies.
- **F8** opens a new sale and **F9** opens a new purchase.

---

## 12. Your data and backups

- Your books are saved on your computer, in your Windows user folder (**File → Open Data Folder**).
- BillBharat makes a **backup automatically** every day and before each update (**File → Open Backups Folder**).
- Keep a second copy: in **Settings → Backup & Restore**, add a folder on a pen drive or in your cloud folder.
- If the app says a backup has not left the computer for a week, copy the backup to a pen drive or your cloud folder.

---

## 13. Common questions

| Problem | What to do |
|---|---|
| I cannot see the Edit button on the invoice | The invoice has payments. Its items can be changed only before payments are recorded. You can still edit or delete each payment in *Payment History*. |
| *Consumables can only be recorded on the Electrical Works line* | Pick **Electrical Works** from the list, then add the parts again. |
| The desktop icon still looks like Electron's | Install the newest BillBharat file. If the old icon stays, restart Windows Explorer or pin the app again. |
| WhatsApp or Email in the desktop app does not attach the PDF | Attach the PDF from your Downloads folder yourself. The message is already filled in. |
| A red *Negative* label on an item | Check your purchases and stock count, then correct the item. |
| I forgot my password | Use the recovery code you wrote down at sign-up. If you lost it and can still sign in, make a new one in **Settings → Recovery code**. |

---

## 14. Updating BillBharat

When a new version is published, you can install it yourself. Your books are kept.

1. Open **Settings** and scroll to **Updates**.
2. Press **Check for updates**.
3. If a newer version is found, BillBharat asks you to confirm. Press **OK** to download it.
4. The new version installs by itself and BillBharat restarts. Nothing needs to be uninstalled.

Before the new version starts, BillBharat saves a copy of your books to the backups folder (File → Open Backups Folder), named `backup_v<old version>_<time>.db`.

- The button needs the **installed** BillBharat, not a browser. It needs internet only when you press it.
- Versions before 1.0.1 do not have the button. Download the installer from https://github.com/Jay-patel15/Bill-Bharat/releases/latest and run it over the old one once.
- The portable version cannot update itself. Download the new installer instead.
