const BANKRUPT = [
    "👹 TORITATEN: Pay up or perish!",
    "👹 TORITATEN: Your kneecaps are looking mighty fragile.",
    "👹 TORITATEN: I can smell your fear... and your debt.",
    "👹 TORITATEN: There is no hiding from the collection agency.",
    "👹 TORITATEN: Tick tock. The interest never sleeps."
];

const CLEAN = [
    "💎 SYSTEM: This user is untouchable.",
    "💎 SYSTEM: Aura levels critical. Maximum respect.",
    "💎 SYSTEM: A shining example of financial discipline.",
    "💎 SYSTEM: Debt free. Soul intact.",
    "💎 SYSTEM: You are glowing. Literally."
];

const NORMAL = [
    "🧚 POTCLEAN: Interest is compounding...",
    "🧚 POTCLEAN: Every day counts. Don't ghost.",
    "🧚 POTCLEAN: I'm calculating your credit score...",
    "🧚 POTCLEAN: Just a friendly reminder: 1% daily.",
    "🧚 POTCLEAN: Stay safe. Stay solvent."
];

export const getRandomQuote = (isBankrupt, isClean) => {
    let pool = NORMAL;
    if (isBankrupt) pool = BANKRUPT;
    else if (isClean) pool = CLEAN;

    // Pick random index
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
};
