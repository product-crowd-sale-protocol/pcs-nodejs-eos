'use strict'

const Eos = require("eosjs");
const Base58 = require("bs58");
const BigInteger = require('bigi');
const { StringType } = require('./types');

/// timestamp -> bytearray
function getSigTimestamp() {
    const duration = 15 * 1000;
    const now = Number(new Date());
    const timestamp = Math.floor(now / duration) * duration;
    const ts_bn = new BigInteger(timestamp.toString());
    const ts_micro = ts_bn.multiply(new BigInteger("1000"));
    return uint64ToBuffer(ts_micro);
}

/// encode name type into raw by big endian
function getNameValue(name) {
    return uint64ToBuffer(Eos().modules.format.encodeName(name, false));
}

/// symbol_code -> bytearray
function getSymbolCodeRaw(symbol_code) {
    if (typeof(symbol_code) !== "string") {
        throw new Error("the first argument should be string type");
    }

    if (symbol_code.length > 7) {
        throw new Error("string is too long to be a valid symbol_code");
    }

    let raw = new BigInteger("0");
    const a_byte = new BigInteger("256");
    for (let i = symbol_code.length - 1; i >= 0; i--) {
        const c = symbol_code[i];
        if (c < 'A' || 'Z' < c) {
            throw new Error("only uppercase letters allowed in symbol_code string");
        }

        raw = raw.multiply(a_byte);
        raw = raw.add(new BigInteger(c.charCodeAt().toString()));
    }

    return uint64ToBuffer(raw);
}

/// public_key -> bytearray
function publicKeyToBuffer(public_key) {
    const pk_prefix = "EOS";
    const pk_body = public_key.slice(pk_prefix.length);
    const raw_pk = Base58.decode(pk_body).slice(0, -4);
    return Buffer.from([0, ...raw_pk]);
}

/// uint64 -> bytearray
function uint64ToBuffer(num) {
    if (!BigInteger.isBigInteger(num)) {
        num = new BigInteger(String(num));
    }

    let accumulator = num;
    const a_byte = new BigInteger("256");
    const bytearray = Array.from({ length: 8 }, () => {
        const [quotient, remainder] = accumulator.divideAndRemainder(a_byte);
        accumulator = quotient;
        return Number(remainder);
    });

    return Buffer.from(bytearray);
}

/// bytearray -> String
function bufferToNum(bytearray) {
    bytearray = Array.from(bytearray);

    const a_byte = new BigInteger("256");
    let bn = new BigInteger("0");
    let multiplier = new BigInteger("1");
    bytearray.forEach((v) => {
        bn = multiplier.multiply(new BigInteger(String(v))).add(bn);
        multiplier = multiplier.multiply(a_byte);
    });
    return bn.toString();
}

function stringToBuffer(str) {
    return StringType.toBuffer(str);
}

module.exports = {
    getSigTimestamp,
    getNameValue,
    getSymbolCodeRaw,
    publicKeyToBuffer,
    uint64ToBuffer,
    bufferToNum,
    stringToBuffer
};
