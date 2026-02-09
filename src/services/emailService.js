import emailjs from '@emailjs/browser';

const EMAIL_SERVICE = "service_ciiisv3";
const EMAIL_TEMPLATE = "template_c3miqvi";
const PUBLIC_KEY = "ePT35yP8-YeX6Ad7n";

export const sendSystemEmail = (type, data, showToast = null, isAdmin = false) => {
    // 1. Safety Check: Does email exist?
    if (!data.email) {
        console.warn(`[Email Service] Skipping ${type}: No email found.`);
        return; 
    }

    // 2. Variable Mapping (The "Fix")
    // We try to find data.totalDebt. If it doesn't exist, we look for data.debt. If neither, we default to 0.
    const finalDebt = data.totalDebt !== undefined ? data.totalDebt : (data.debt || 0);
    const finalDays = data.daysMissed !== undefined ? data.daysMissed : (data.days || 0);

    const params = {
        to_name: data.name || "User",
        to_email: data.email,
        debt: finalDebt, 
        days: finalDays,
        theme_color: "#ffffff",
        title: "NOTICE",
        message_intro: "",
        status_text: "",
        status_label: "ACTIVE"
    };

    // 3. Content Configuration
    switch(type) {
        case 'BANKRUPTCY':
            params.theme_color = "#ff4444"; 
            params.title = "CHAPTER 7 BANKRUPTCY";
            params.message_intro = "Your interaction balance has reached a critical deficit.";
            params.status_text = "COLLECTION NOTICE";
            params.status_label = "TORITATEN (Collection)";
            break;
        case 'RESET':
            params.theme_color = "#ffd700"; 
            params.title = "INTERACTION LOGGED";
            params.message_intro = "We spoke today. Your timer has been reset, but your debt remains.";
            params.status_text = "TIMER RESET";
            params.status_label = "INTEREST COMPOUNDING";
            break;
        case 'PAID':
            params.theme_color = "#00C851"; 
            params.title = "DEBT CLEARED";
            params.message_intro = "Your payment has been accepted. Balance wiped clean.";
            params.status_text = "PAID IN FULL";
            params.status_label = "GOOD STANDING";
            params.debt = 0; 
            break;
        default:
            return;
    }

    // 4. Send
     emailjs.send(EMAIL_SERVICE, EMAIL_TEMPLATE, params, PUBLIC_KEY)
        .then(() => {
            console.log(`[System] ${type} email sent to ${data.email}`);
            if (isAdmin && showToast) {
                showToast(`${type} Sent!`, "INFO");
            }
        })
        .catch(e => {
            console.error("System Email Failed:", e);
            if (isAdmin && showToast) {
                // SHOW THE REAL REASON (e.text)
                // Common errors: "Quota Exceeded", "Rate Limit Reached"
                showToast(`Email Error: ${e.text || "Unknown"}`, "ERROR");
            }
        });
};

 