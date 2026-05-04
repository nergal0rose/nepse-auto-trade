# NEPSE Auto Trade Extension 📈

A high-performance, fully automated trading extension for the NEPSE (Nepal Stock Exchange) Trade Management System (TMS). 

This extension injects a highly responsive script directly into the TMS platform. It constantly polls the live market data and executes complex trading strategies (like breakout buys and trailing threshold triggers) automatically—faster than humanly possible.

---

## 🚀 Key Features

*   **Live Market Data Pipeline**: The bot establishes a hidden data connection to the NEPSE Market Watch panel, reading Live Traded Prices (LTP) in real-time without needing to constantly refresh the order form.
*   **Exchange Price Band Validation**: The bot automatically checks your target prices against the exchange's strict ±3% LTP boundary rule, gracefully pausing and retrying if the market shifts out of bounds.
*   **Silent Mode (Ghost Tab)**: Enable this to launch a hidden, pinned background tab that does all the trading. This prevents the bot from hijacking your active browser tabs, allowing you to browse reports and portfolios freely while the bot works autonomously in the background.
*   **Customizable UI**: Includes 5 beautiful color themes (Default, Aquatic, Desert, Dusk, Night Green) and Font Size scaling to fit your personal workflow.

---
## Disclaimer : "Use at your own risk. This tool automates your own account using your own credentials inside your browser. Not affiliated with NEPSE or any broker."

## 🛠️ Installation Guide

Because this is a powerful private tool, it is not listed on the Chrome Web Store. You must install it manually in **Developer Mode**.

1. Download the extension folder or extract the `.zip` file into a folder on your computer.
2. Open Google Chrome (or Edge/Brave) and navigate to `chrome://extensions/`.
3. In the top right corner, **Turn ON Developer mode**.
4. Click the **Load unpacked** button in the top left.
5. Select the `nepse_tms_extension` folder.
6. The *NEPSE Auto Trade* icon will appear in your Chrome toolbar. Ensure you pin the extension to your toolbar for easy access!

---

## 📋 How to Use

The extension operates in two distinct modes: **Planning Mode** (where you stage your trades) and **Execution Mode** (where the bot goes to work).

### 1. Planning Mode
Open the extension popup while logged into TMS. You can safely add, edit, or delete as many pending orders as you want (up to 10 mapped symbols).

**Form Breakdown:**
1.  **Symbol**: Type the stock symbol (e.g., `NABIL`, `SPDL`). It will auto-suggest from the official NEPSE list.
2.  **Qty**: Enter the number of shares to trade (minimum 10 per NEPSE rules).
3.  **Type**: `BUY` or `SELL`.
4.  **Base Price**: Your primary "Anchor" price used to trigger the bot. See *Strategies* below.
5.  **Trigger Condition**: 
    *   `if LTP ≈ Base (%)`: A floating bracket strategy. The bot triggers if the live market price comes within your specified percentage of the base price (e.g., within ±3% LTP of Rs. 1000).
### 2. Execution Mode
Once your orders are planned:
1.  Toggle **Silent Mode (👻)** to ON if you want the bot to run invisibly.
2.  Toggle the main **Execution Switch** at the top right to **ON**.
3.  The bot is now **Armed**.
4.  You can view the bot's live decision-making logs spinning in the **Live Audit Trail** at the bottom of the popup.

> ⚠️ **IMPORTANT**: You must be actively logged into your NEPSE TMS account in your browser. The bot utilizes your active session cookies to execute orders. If your session expires, the bot will halt.

### 3. The Kill Switch
If the market acts unpredictably and you need to stop all automation instantly, open the popup and click the red **STOP ALL** button, or toggle the Execution switch back to OFF. The bot will instantly disarm safely.

---

## 🧠 Trading Strategies (Examples)

### Strategy 1: "Breakout Buy" (LTP >=)
*You want to buy NABIL, but only if it proves it has momentum by crossing 600.*
*   **Type**: BUY
*   **Base Price**: 600
*   **Condition**: `if LTP =3% of Base`
*   **Target**: Exact Price
*   **Result**: The bot waits. If NABIL hits 618, 615, etc., it fires a buy limit order exactly at 600.
---

## ⚙️ Settings
Click the **Gear ⚙️ Icon** in the top header to reveal UI settings:
---

## 🛡️ Safety & Limitations (What it DOES NOT do)
For your security and awareness, please note that this extension is strictly a front-end automation script. 

*   **It does NOT steal data:** Your credentials, mapped symbols, and orders are stored entirely **locally** in your browser via `chrome.storage.local`. The extension does not connect to any external third-party servers.
*   **It does NOT auto-login:** You must log into TMS and pass the captcha yourself. The bot only automates the trading form.
*   **It does NOT break NEPSE rules:** The bot cannot force an order outside the dynamic ±2% LTP band. It calculates the exchange's legal band internally and will automatically pause and wait for the market to move into compliance before submitting.
*   **It does NOT guarantee execution:** The extension mimics human clicks at superhuman speeds, but it is still subject to NEPSE server lag, broker API downtime, or sudden market suspensions.
*   **It does NOT place phantom orders:** It only clicks the final "Buy" or "Sell" button if the real-time data strictly matches the conditions you configured in the planning form.

##⚠️ Educational Purpose Disclaimer
This project was developed strictly for educational and research purposes.
It is a personal learning project built to understand how browser extensions work, how to interact with web-based trading platforms programmatically, and how algorithmic trading logic can be structured and tested.
This tool is not intended for real financial use. The developer does not take any responsibility for financial losses, account suspensions, or any consequences arising from the use of this software.

This extension is not affiliated with, endorsed by, or associated with NEPSE, any broker, or any regulatory body in Nepal.
Use of automated tools on broker platforms may violate their terms of service. Always check with your broker before use.
The developer built this as a coding and finance learning exercise only.

##Use entirely at your own risk.

## 📄 License

This project is licensed under the MIT License.
Built for educational and research purposes only.
See [LICENSE](LICENSE) for full details.
