# ⚡ AFCCL Electric Bill Invoice Generator

A professional, full-stack electric bill management system designed for administrative efficiency. This application allows for customer management, automated bill calculation, professional A4 PDF generation with dual copies (Customer + Office), and comprehensive bill analysis.

## 🚀 Key Features

-   **Admin Dashboard:** Secure JWT-based authentication for a single administrator.
-   **Customer Management:** Searchable directory to manage customer details, addresses, and meter numbers.
-   **Dynamic Rate Configuration:** Configure electricity rates (BDT/kWh), service charges, and VAT percentages with live bill previews.
-   **Professional Invoice Generation:**
    -   Smart search for selecting customers by name or meter number.
    -   Month-based bill tracking (YYYY-MM).
    -   Automatic consumption calculation from previous/current readings.
    -   Optional fine/penalty application with notes.
-   **Advanced PDF Generator:**
    -   Generates standard A4 PDF containing both **Customer Copy** and **Office Copy** on a single page.
    -   Dynamic **PAID Seal** with automated payment date stamping.
    -   Customizable header (Logo, Title, Address, Contact) and footer.
    -   Smart naming convention: `InvoiceNo-CustomerName-MeterNo.pdf`.
-   **Bill Analyzer:**
    -   Track all generated invoices with status indicators (Paid/Unpaid).
    -   Advanced filtering by Month/Year, Name, Meter No, Address, or Invoice No.
    -   One-click status toggling (Mark as Paid/Unpaid).
    -   Summary statistics (Total, Paid BDT, Unpaid BDT).

## 🛠 Tech Stack

-   **Frontend:** React (Vite), Axios, React Router, jsPDF, jsPDF-AutoTable.
-   **Backend:** Node.js, Express.js, JWT (JsonWebToken), BcryptJS.
-   **Database:** MongoDB (Mongoose).
-   **Styling:** Vanilla CSS (Modern, Responsive Design).

## 📥 Installation & Setup

### Prerequisites

-   Node.js (v18+)
-   MongoDB (Local or Atlas)

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/faketi101/afccl-electric-bill-generator.git
cd afccl-electric-bill-generator

# Install Root & Backend dependencies
npm install

# Install Frontend dependencies
cd client
npm install
cd ..
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/electric_bill_db
JWT_SECRET=your_secure_random_string
CLIENT_URL=http://localhost:5173
```

### 3. Create Admin Account (One-time)

Run the seed script to initialize the administrator credentials:

```bash
node server/seed.js
```
*Default Credentials: `admin` / `ChangeMe123!` (Change immediately after login).*

## 🏃‍♂️ How to Run

### Development Mode

Run the backend and frontend simultaneously:

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd client
npm run dev
```

### Production Build

```bash
# Build the React frontend
npm run build

# Start the Express server (serves the built frontend from /dist)
npm start
```

## 🌐 Deployment Notes (cPanel)

1.  Run `npm run build` locally to generate the `/dist` folder.
2.  Upload `server/`, `dist/`, `package.json`, and `.env` to your server.
3.  In cPanel Node.js App Setup:
    -   Set Application Startup file to `server/index.js`.
    -   Ensure environment variables are set in the cPanel UI.
    -   Use a MongoDB Atlas URI for production database storage.

---
Built with ❤️ for AFCCL Utility Management.
