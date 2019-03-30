'use strict'

/**
 * generate plain text to sign by subsig private key
 */
function getSubsigMessage() {
    const a_day = 24 * 60 * 60 * 1000;
    const message = String(Math.floor(Number(new Date()) / a_day) * a_day);
    return message;
}

module.exports = {getSubsigMessage};
