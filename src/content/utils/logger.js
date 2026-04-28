
// src/content/utils/logger.js
export const log = (...messages) => {
    // Only log if a debug flag is set in config, or if a global debug mode is enabled
    // For now, always log
    console.log('[Basuki Injected]', ...messages);
};

