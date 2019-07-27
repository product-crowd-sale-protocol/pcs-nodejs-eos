"use strict";

const BigInteger = require("bigi");
const Base58 = require("bs58");

/// convert into big integer
function toBI(num) {
    if (num instanceof Buffer) {
        return new BigInteger(Array.from(num).reverse());
    } else if (num instanceof Array) {
        return new BigInteger(num);
    } else if (typeof(num) === "string") {
        num.split("").forEach((c) => {
            if ((c < "0" || "9" < c) && (c !== "-")) {
                throw new Error("only '0123456789-' must be included in BigInteger," +
                                " but given argument is", num);
            }
        });
        num = new BigInteger(num);
    } else if (Number.isSafeInteger(num)) {
        num = new BigInteger(String(num));
    } else if (num == null) {
        num = new BigInteger("0");
    } else if (!BigInteger.isBigInteger(num)) {
        throw new Error("'num' cannot convert into BigInteger");
    }

    return num;
}

/// convert into safe integer for js
function toSI(num) {
    if (num == null) {
        num = 0;
    }

    if (num instanceof Buffer) {
        num = Array.from(num).reverse();
    }

    if (num instanceof Array) {
        num = new BigInteger(num);
    }

    if (BigInteger.isBigInteger(num)) {
        num = num.toString();
    }

    if (typeof(num) === "string") {
        num = parseInt(num);
    }

    if (!Number.isSafeInteger(num)) {
        throw new Error("'num' cannot convert into safe integer");
    }

    return num;
}

function Uint(bits) {
    if (!Number.isSafeInteger(bits) || bits <= 0) {
        throw new Error("'bits' must be positive integer");
    }

    if (bits % 8 !== 0) {
        throw new Error("'bits' must be multiplication of 8");
    }

    const bytes = bits / 8;
    const byte_mask = new BigInteger("ff", 16);
    const uint_mask = new BigInteger(Array.from({ length: bits }, () => "1").join(""), 2);
    function FixedUint(uint) {
        return toBI(uint).and(uint_mask);
    }

    FixedUint.isValid = function (uint) {
        try {
            uint = toBI(uint);
            return uint.and(uint_mask).equals(uint);
        } catch (err) {
            return false;
        }
    };

    FixedUint.toByteArray = function (uint) {
        let value = toBI(uint);
        const bytearray = Array.from({ length: bytes }, () => {
            const v = value.and(byte_mask);
            value = value.shiftRight(8);
            return Number(v);
        });

        return bytearray;
    };

    FixedUint.toBuffer = function (uint) {
        return Buffer(FixedUint.toByteArray(uint));
    };

    FixedUint.fromBuffer = function (buffer, pos=0) {
        let data = new BigInteger("0");
        const bytearray = Array.from(Buffer(buffer));
        for (let i = 0; i < bytes; i++) {
            const v = new BigInteger(String(bytearray[pos]));
            pos++;
            data = v.shiftLeft(8 * i).add(data);
        }

        return {data, pos};
    };

    return FixedUint;
}

function Int(bits) {
    if (!Number.isSafeInteger(bits) || bits <= 0) {
        throw new Error("'bits' must be positive integer");
    }

    if (bits % 8 !== 0) {
        throw new Error("'bits' must be multiplication of 8");
    }

    const bytes = bits / 8;
    const byte_mask = new BigInteger("ff", 16);
    const uint_mask = new BigInteger(Array.from({ length: bits }, () => "1").join(""), 2);
    const int_mask = new BigInteger(Array.from({ length: bits - 1 }, () => "1").join(""), 2);

    const FixedInt = (int) => {
        int = toBI(int);
        const value = int.and(int_mask);
        const sign = int.and(BigInteger.ONE.shiftLeft(bits - 1));
        return value.subtract(sign);
    };

    FixedInt.isValid = function (int) {
        try {
            int = toBI(int);
            return int.and(uint_mask).equals(int);
        } catch (err) {
            return false;
        }
    };

    FixedInt.toByteArray = function (int) {
        let value = toBI(int);
        const bytearray = Array.from({ length: bytes }, () => {
            const v = value.and(byte_mask);
            value = value.shiftRight(8);
            return Number(v);
        });

        return bytearray;
    };

    FixedInt.toBuffer = function (int) {
        return Buffer(FixedInt.toByteArray(int));
    };

    FixedInt.fromBuffer = function (buffer, pos=0) {
        let data = new BigInteger("0");
        const bytearray = Array.from(Buffer(buffer));
        for (let i = 0; i < bytes; i++) {
            const v = new BigInteger(String(bytearray[pos]));
            pos++;
            data = v.shiftLeft(8 * i).add(data);
        }

        data = FixedInt(data);
        return {data, pos};
    };

    return FixedInt;
}

function UnsignedInt(num) {
    const value = toBI(num);
    if (value.signum() < 0) {
        throw new Error(`must be positive integer, but ${num} is given`);
    }

    return value;
}

UnsignedInt.toBuffer = function (num) {
    const bytearray = [];
    const mask = new BigInteger("1111111", 2);
    const carry = new BigInteger("10000000", 2);
    let value = toBI(num);
    let v = value.and(mask);
    value = value.shiftRight(7);
    while (value.signum() !== 0) {
        bytearray.push(toSI(carry.add(v)));
        v = value.and(mask);
        value = value.shiftRight(7);
    }

    bytearray.push(toSI(v));
    return Buffer(bytearray);
};

UnsignedInt.fromBuffer = function (buffer, pos=0) {
    const bytearray = new Uint8Array(buffer);
    const mask = new BigInteger("1111111", 2);
    const carry = Number("0b10000000");
    let data = new BigInteger("0");
    let i = 0;
    let v = bytearray[pos++];
    while ((v & carry) !== 0) {
        data = data.add(toBI(v & mask).shiftLeft(7 * i));
        i++;
        v = bytearray[pos++];
    }

    data = data.add(toBI(v & mask).shiftLeft(7 * i));
    return {data, pos};
};

function SymbolCode(symbol_code) {
    if (BigInteger.isBigInteger(symbol_code)) {
        symbol_code = SymbolCode.fromRaw(symbol_code);
    } else if (Number.isSafeInteger(symbol_code)) {
        symbol_code = SymbolCode.fromRaw(symbol_code);
    } else if (symbol_code == null) {
        symbol_code = SymbolCode.fromRaw(0);
    } else if (typeof(symbol_code) !== "string") {
        throw new Error("cannot convert into symbol_code type");
    }

    if (symbol_code.length > 7) {
        throw new Error("string is too long to be a valid symbol_code");
    }

    for (let i = symbol_code.length - 1; i >= 0; i--) {
        const c = symbol_code[i];
        if (c < 'A' || 'Z' < c) {
            throw new Error("only uppercase letters allowed in symbol_code string");
        }
    }

    return symbol_code;
}

SymbolCode.isValid = function (symbol_code) {
    if (BigInteger.isBigInteger(symbol_code)) {
        try {
            symbol_code = SymbolCode.fromRaw(symbol_code);
        } catch (err) {
            return false;
        }
    } else if (typeof(symbol_code) === "number") {
        try {
            symbol_code = SymbolCode.fromRaw(symbol_code);
        } catch (err) {
            return false;
        }
    } else if (typeof(symbol_code) !== "string") {
        /// cannot convert into symbol_code type
        return false;
    }

    if (symbol_code.length > 7 || symbol_code.length === 0) {
        /// string is too long to be a valid symbol_code, or
        /// given string is empty
        return false;
    }

    for (let i = symbol_code.length - 1; i >= 0; i--) {
        const c = symbol_code[i];
        if (c < 'A' || 'Z' < c) {
            /// only uppercase letters allowed in symbol_code string
            return false;
        }
    }

    return true;
};

SymbolCode.toRaw = function (symbol_code) {
    symbol_code = String(symbol_code);

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

    return raw;
};

SymbolCode.fromRaw = function (raw) {
    const bytearray = Uint(64).toByteArray(raw);
    let symbol_code = "";
    let i = 0;
    while (i < 8) {
        const c = bytearray[i];
        if (i !== 7 && 'A'.charCodeAt() < c && c < 'Z'.charCodeAt()) {
            symbol_code += String.fromCharCode(c);
        } else if (c === 0) {
            i++;
            while (i < 8) {
                if (bytearray[i] !== 0) {
                    throw new Error("invalid symbol code raw");
                }
                i++;
            }
        } else {
            throw new Error("only uppercase letters allowed in symbol_code string");
        }
        i++;
    }

    return symbol_code;
};

SymbolCode.toByteArray = function (symbol_code) {
    return Uint(64).toByteArray(SymbolCode.toRaw(symbol_code));
};

SymbolCode.toBuffer = function (symbol_code) {
    return Buffer(SymbolCode.toByteArray(symbol_code));
};

SymbolCode.fromBuffer = function (buffer, pos=0) {
    const symbol_code_ds = Uint(64).fromBuffer(buffer, pos);
    return {
        data: SymbolCode.fromRaw(symbol_code_ds.data),
        pos: symbol_code_ds.pos
    };
};

function SymbolType(symbol_code, precision) {
    if (precision == null) {
        precision = 0;
    }

    precision = Number(precision);

    if (!Number.isSafeInteger(precision) || precision < 0 || 255 < precision) {
        throw new Error("'precision' is integer between 0 to 255");
    }

    return {
        symbol_code: SymbolCode(symbol_code),
        precision: precision
    };
}

SymbolType.isValid = function (symbol) {
    if (typeof(symbol) !== "object") {
        return false;
    }

    let { symbol_code, precision } = symbol;

    if (!SymbolCode.isValid(symbol_code)) {
        return false;
    }

    try {
        precision = Number(precision);
    } catch (err) {
        return false;
    }

    if (!Number.isSafeInteger(precision) || precision < 0 || 255 < precision) {
        /// 'precision' type is integer between 0 to 255
        return false;
    }

    return true;
};

SymbolType.toRaw = function (symbol) {
    if (!SymbolType.isValid(symbol)) {
        throw new Error("given argument must be SymbolType");
    }

    const { symbol_code, precision } = symbol;

    return SymbolCode.toRaw(symbol_code)
        .shiftLeft(8)
        .add(toBI(precision));
};

SymbolType.fromRaw = function (raw) {
    raw = Uint(64)(raw);
    const byte_mask = new BigInteger("ff", 16);
    const symbol_code = SymbolCode.fromRaw(raw.shiftRight(8));
    const precision = toSI(raw.mask(byte_mask));
    return SymbolType(symbol_code, precision);
};

SymbolType.toByteArray = function (symbol) {
    return Uint(64).toByteArray(SymbolType.toRaw(symbol));
};

SymbolType.toBuffer = function (asset) {
    return Buffer(SymbolType.toByteArray(asset));
};

SymbolType.fromBuffer = function (buffer, pos=0) {
    const symbol_ds = Uint(64).fromBuffer(buffer, pos);
    return {
        data: SymbolType.fromRaw(symbol_ds.data),
        pos: symbol_ds.pos
    };
};

function Asset(amount, symbol_code, precision) {
    const amount_bn = Int(64)(amount);
    const sign = Number(amount_bn.shiftRight(62).and(new BigInteger("11", 2)).toString(2));
    if (sign !== 0 && sign !== 3) {
        throw new Error("magnitude of asset amount must be less than 2^62");
    }

    return {
        amount: amount_bn.toString(),
        symbol: SymbolType(symbol_code, precision)
    };
}

Asset.isValid = function (asset) {
    if (typeof(asset) === "string") {
        asset = Asset.fromString(asset);
    } else if (typeof(asset) !== "object") {
        return false;
    }

    const { amount, symbol } = asset;

    try {
        const sign = Number(Int(64)(amount).shiftRight(62).and(new BigInteger("11", 2)).toString(2));
        if (sign !== 0 && sign !== 3) {
            /// magnitude of asset amount must be less than 2^62
            return false;
        }
    } catch (err) {
        /// asset amount cannot convert to BigInteger type
        return false;
    }

    if (!SymbolType.isValid(symbol)) {
        return false;
    }

    return true;
};

Asset.toString = function (asset) {
    if (!Asset.isValid(asset)) {
        throw new Error("given argument must be Asset type");
    }

    const { amount, symbol: {symbol_code, precision} } = asset;
    const ten = new BigInteger("10");
    const [quotient, remainder] = toBI(amount).divideAndRemainder(ten.pow(precision));
    return quotient.toString() +
        "." + remainder.toString().padStart(precision, "0").toString() +
        " " + symbol_code;
};

Asset.fromString = function (asset_str) {
    const [amount_str, symbol_code] = asset_str.split(" ");
    const [quotient, remainder] = amount_str.split(".");
    const amount = quotient + (remainder || "");
    const precision = remainder ? remainder.length : 0;
    return Asset(amount, symbol_code, precision);
};

Asset.toByteArray = function (asset) {
    if (typeof asset === "string") {
        asset = Asset.fromString(asset);
    }

    if (typeof(asset) !== "object") {
        return false;
    }

    const { amount, symbol } = asset;
    return [...Int(64).toByteArray(amount), ...SymbolType.toByteArray(symbol)];
};

Asset.toBuffer = function (asset) {
    return Buffer(Asset.toByteArray(asset));
};

Asset.fromBuffer = function (buffer, pos) {
    const amount_ds = Int(64).fromBuffer(buffer, pos);
    const amount = amount_ds.data;
    const symbol_ds = SymbolType.fromBuffer(buffer, amount_ds.pos);
    const symbol = symbol_ds.data;
    return {
        data: { amount, symbol },
        pos: symbol_ds.pos
    };
};

function Name(name) {
    if (typeof(name) === "string" && Name.isValid(name)) {
        return name;
    } else if (BigInteger.isBigInteger(name)) {
        return Name.fromValue(name);
    } else if (Number.isSafeInteger(name)) {
        return Name.fromValue(name);
    } else if (name == null) {
        return "";
    } else {
        throw new Error("'name' cannot convert into Name type");
    }
}

Name.isValid = function (name) {
    if (typeof(name) !== "string") {
        /// given argument is not string type
        return false;
    }

    if (name.length > 13 || name.length === 0) {
        /// string is too long to be a valid symbol_code, or
        /// given string is empty
        return false;
    }

    const charmap = ".12345abcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < name.length; i++) {
        const v = charmap.indexOf(name[i]);
        if (v === -1) {
            /// character is not in allowed character set for names
            return false;
        }
    }

    if (name.length === 13) {
        const v = charmap.indexOf(name[12]);
        if (v === -1 || v > 15) {
            /// character is not in allowed character set for names, or
            /// thirteenth character in name cannot be a letter that comes after j
            return false;
        }
    }

    return true;
};

Name.toValue = function (name) {
    if (typeof(name) !== "string") {
        throw new Error("given argument is not string type: " + name);
    }

    if (name.length > 13) {
        throw new Error("string is too long to be a valid symbol_code");
    }

    let value = new BigInteger("0");
    const n = Math.min(name.length, 12);
    const charmap = ".12345abcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < n; i++) {
        const v = charmap.indexOf(name[i]);
        if (v === -1) {
            throw new Error("character is not in allowed character set for names");
        }

        value = value.shiftLeft(5);
        value = value.add(new BigInteger(String(v)));
    }

    value = value.shiftLeft(4 + 5 * (12 - n));

    if (name.length === 13) {
        const v = charmap.indexOf(name[12]);
        if (v === -1) {
            throw new Error("character is not in allowed character set for names");
        } else if (v > 15) {
            throw new Error("thirteenth character in name " +
                            "cannot be a letter that comes after j");
        }

        value = value.add(new BigInteger(String(v)));
    }

    return value;
};

Name.fromValue = function (value) {
    const charmap = ".12345abcdefghijklmnopqrstuvwxyz";
    let name = "";
    let value_bn = Uint(64)(value);
    let mod = BigInteger.ONE.shiftLeft(64);
    for (let i = 0; i < 12; i++) {
        if (value_bn.toString() === "0") {
            return name;
        }

        mod = mod.shiftRight(5);
        const [quotient, remainder] = value_bn.divideAndRemainder(mod);
        value_bn = remainder;
        name += charmap[Number(quotient.toString())];
    }

    const last_char = Number(value_bn.toString());
    if (last_char !== 0) {
        name += charmap[last_char];
    }

    return name;
};

Name.toByteArray = function (name) {
    return Uint(64).toByteArray(Name.toValue(name));
};

Name.toBuffer = function (name) {
    return Buffer(Name.toByteArray(name));
};

Name.fromBuffer = function (buffer, pos=0) {
    const name_ds = Uint(64).fromBuffer(buffer, pos);
    return {
        data: Name.fromValue(name_ds.data),
        pos: name_ds.pos
    };
};

function PermissionLevel(actor, permission) {
    return {
        actor: Name(actor),
        permission: Name(permission)
    };
}

PermissionLevel.isValid = function (permission_level) {
    if (typeof(permission_level) === "string") {
        try {
            permission_level = PermissionLevel.fromString(permission_level);
        } catch (err) {
            /// cannot convert into PermissionLevel type
            return false;
        }
    } else if (typeof(permission_level) !== "object") {
        /// given argument is not Object type
        return false;
    }

    let { actor, permission } = permission_level;

    if (!Name.isValid(actor)) {
        return false;
    }

    if (!Name.isValid(permission)) {
        return false;
    }

    return true;
};

PermissionLevel.toString = function (permission_level) {
    if (typeof(permission_level) !== "object") {
        throw new Error("given argument is not Object type");
    }

    let { actor, permission } = permission_level;
    return Name(actor) + "@" + Name(permission);
};

PermissionLevel.fromString = function (str) {
    const [actor, permission] = str.split("@");
    return {
        actor: Name(actor),
        permission: Name(permission)
    };
};

PermissionLevel.toByteArray = function (permission_level) {
    if (typeof(permission_level) !== "object") {
        throw new Error("given argument is not Object type");
    }

    let { actor, permission } = permission_level;
    return [...Name.toByteArray(actor), ...Name.toByteArray(permission)];
};

PermissionLevel.toBuffer = function (permission_level) {
    return Buffer(PermissionLevel.toByteArray(permission_level));
};

PermissionLevel.fromBuffer = function (buffer, pos) {
    const actor_ds = Name.fromBuffer(buffer, pos);
    const actor = actor_ds.data;
    const permission_ds = Name.fromBuffer(buffer, actor_ds.pos);
    const permission = permission_ds.data;
    return {
        data: {actor, permission},
        pos: permission_ds.pos
    };
};

function TimePointSec(utc_seconds) {
    if (typeof utc_seconds === "string") {
        utc_seconds = new Date(utc_seconds + ".000Z");
    } else if (BigInteger.isBigInteger(utc_seconds)) {
        utc_seconds = new Date(toSI(utc_seconds) * 1000);
    } else if (Number.isSafeInteger(utc_seconds)) {
        utc_seconds = new Date(utc_seconds * 1000);
    } else if (utc_seconds == null) {
        utc_seconds = new Date(); /// now
    }

    if (!(utc_seconds instanceof Date)) {
        throw new Error("'utc_seconds' cannot convert into TimePointSec type");
    }

    return {
        utc_seconds: Math.floor(Number(utc_seconds) / 1000)
    };
}

TimePointSec.isValid = function (time_point_sec) {
    if (typeof time_point_sec !== "object") {
        return false;
    }

    return Uint(32).isValid(time_point_sec.utc_seconds);
};

TimePointSec.toBuffer = function (time_point_sec) {
    if (!TimePointSec.isValid(time_point_sec)) {
        time_point_sec = TimePointSec(time_point_sec);
    }

    return Uint(32).toBuffer(time_point_sec.utc_seconds);
};

TimePointSec.toString = function (time_point_sec) {
    if (!TimePointSec.isValid(time_point_sec)) {
        time_point_sec = TimePointSec(time_point_sec);
    }

    const timestamp = toSI(time_point_sec.utc_seconds) * 1000;
    const d = new Date(timestamp);
    const YYYY = d.getUTCFullYear().toString().padStart(4, "0");
    const MM = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    const DD = d.getUTCDate().toString().padStart(2, "0");
    const hh = d.getUTCHours().toString().padStart(2, "0");
    const mm = d.getUTCMinutes().toString().padStart(2, "0");
    const ss = d.getUTCSeconds().toString().padStart(2, "0");
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}`;
};

TimePointSec.fromBuffer = function (buffer, pos=0) {
    const utc_seconds = Uint(32).fromBuffer(buffer);
    return {
        data: TimePointSec(utc_seconds.data),
        pos: utc_seconds.pos
    };
};

function packActionData(action_data, action_data_type) {
    if (typeof action_data === "string") {
        /// if action_data is string, it is regarded as hex.
        return DataStream.fromHex(action_data);
    } else if (typeof action_data === "object" && action_data_type != null) {
        /// if action_data is object,
        /// then transform it under action_data_type.
        return DataStream.from(action_data, action_data_type);
    } else if (action_data instanceof DataStream) {
        /// if action_data has already been DataStream type,
        /// then slice unnecessary part of it.
        return DataStream.from(action_data.data.slice(0, action_data.pos));
    } else {
        throw new Error("cannot pack action data");
    }
}

function Action(account, name, authorization, data) {
    authorization = authorization.map((auth) => {
        if (!PermissionLevel.isValid(auth)) {
            return PermissionLevel(auth);
        } else {
            return auth;
        }
    });

    return {
        account: Name(account),
        name: Name(name),
        authorization: authorization,
        data: packActionData(data)
    };
}

Action.toBuffer = function (action) {
    const action_type = {
        account: "Name",
        name: "Name",
        authorization: "vector<PermissionLevel>",
        data: "vector<Int(8)>"
    };
    const ds = DataStream.from(action, action_type);
    return Buffer(ds.data).slice(0, ds.pos);
};

Action.fromBuffer = function (buffer, pos=0) {
    const action_type = {
        account: "Name",
        name: "Name",
        authorization: "vector<PermissionLevel>",
        data: "vector<Int(8)>"
    };
    const ds = DataStream.from(Array.from(buffer));
    ds.pos = pos;
    const action = ds.read(action_type);
    return {
        data: action,
        pos: ds.pos
    };
};

/***
string のバイト列表現は最初の 32 ビットに文字列の長さをリトルエンディアンで格納
***/
function StringType(str) {
    return String(str);
}

StringType.toBuffer = function (str) {
    const data = Buffer(String(str), "utf-8");
    const size = UnsignedInt.toBuffer(data.length);
    return Buffer([...Array.from(size), ...Array.from(data)]);
};

StringType.fromBuffer = function (buffer, pos=0) {
    const ds = new DataStream(buffer, pos);
    const size = toSI(ds.read("UnsignedInt"));
    const data = ds.read(size);
    return Buffer(data).toString("utf-8");
};

/// 未完成
function Extension() {
    return;
}

Extension.toBuffer = function () {
    return;
};

Extension.fromBuffer = function () {
    return　"";
};

function PublicKey() {
    const pk_type = {
        type: "UnsignedInt",
        data: Array.from("array<Int(8),33>")
    };

    return {

    };
}

PublicKey.toBuffer = function (public_key) {
    const pk_prefix = "EOS";
    const pk_body = public_key.slice(pk_prefix.length);
    const raw_pk = Base58.decode(pk_body).slice(0, -4);
    return Buffer([0].concat(Array.from(raw_pk)));
};

PublicKey.fromBuffer = function (buffer) {
    if (buffer[0] !== 0) {
        throw new Error(`
            public key version is invalid.
            the first byte of public key should be 0`
        );
    }

    const pk_prefix = "EOS";
    const pk_body = Base58.encode(buffer.slice(1));
    console.log(pk_prefix, pk_body);
    /// add checksum
};

function convertByteArray(value, type) {
    if (type == null || type === "char") {
        return value.map((v) => {
            const byte = Number(v);
            if (Number.isSafeInteger(byte)) {
                return [byte & "0b11111111"];
            } else {
                throw new Error("'value' cannot convert into integer");
            }
        });
    } else if (typeof type === "string") {
        const vector_match = type.match(/^vector<([0-9A-Za-z()<>,]+)>$/);
        const tuple_match = type.match(/^tuple<(([0-9A-Za-z()<>]+\s*,\s*)*([0-9A-Za-z()<>]+\s*))>$/);
        if (vector_match) {
            const vector_size = value.length;
            const data = convertByteArray(vector_size, "UnsignedInt");
            return value.reduce((acc, v) => acc.concat(convertByteArray(v, vector_match[1])), data);
        } else if (tuple_match) {
            const types = tuple_match[1].split(/\s*,\s*/);
            return convertByteArray(value, types);
        } else {
            const values = eval(type).toBuffer(value);
            return values.reduce((acc, v) => acc.concat(convertByteArray([v])), []);
        }
    } else if (type instanceof Array) {
        return type.reduce((acc, t, i) => acc.concat(convertByteArray(value[i], t)), []);
    } else if (typeof type === "object") {
        return Object.keys(type).reduce((acc, m) => acc.concat(convertByteArray(value[m], type[m])), []);
    } else {
        throw new Error("'type' should be null, string, array or object type");
    }
}

function DataStream(size) {
    if (!Number.isSafeInteger(size) || size < 0) {
        throw new Error(`'size' must be positive integer`);
    }

    this.data = Array.from({length: size});
    this.pos = 0;
}

DataStream.prototype.checkPosition = function () {
    const pos = this.pos;
    const size = this.data.byteLength;
    if (!Number.isSafeInteger(pos) || pos < 0 || size <= pos) {
        throw new Error(`
            cannot operate datastream beyond the length of binary data.
            now 'pos' is ${pos}`
        );
    }
};

DataStream.prototype.get = function () {
    this.checkPosition();
    return this.data[this.pos++];
};

DataStream.prototype.read = function (type) {
    if (type == null || type === "char") {
        return this.get();
    } else if (Number.isSafeInteger(type)) {
        return Array.from({length: type}, () => this.read());
    } else if (typeof type === "string") {
        /// 構文解析は完璧でない
        const vector_match = type.match(/^vector<([0-9A-Za-z()<>,]+)>$/);
        const tuple_match = type.match(/^tuple<(([0-9A-Za-z()<>]+\s*,\s*)*([0-9A-Za-z()<>]+\s*))>$/);
        if (vector_match) {
            const vector_size = toSI(this.read("UnsignedInt"));
            return Array.from({length: vector_size}, () => this.read(vector_match[1]));
        } else if (tuple_match) {
            const types = tuple_match[1].split(/\s*,\s*/);
            return this.read(types);
        } else {
            const {data, pos} = eval(type).fromBuffer(this.data, this.pos);
            this.pos = pos;
            return data;
        }
    } else if (type instanceof Array) {
        const data = [];
        type.forEach((t) => {
            data.push(this.read(t));
        });

        return data;
    } else if (typeof type === "object") {
        const data = {};
        Object.keys(type).forEach((m) => {
            data[m] = this.read(type[m]);
        });

        return data;
    } else {
        throw new Error("'type' is invalid");
    }
};

DataStream.prototype.put = function (value) {
    this.checkPosition();
    value = Number(value);

    if (Number.isSafeInteger(value)) {
        this.data[this.pos++] = value & "0b11111111";
        return true;
    } else {
        throw new Error("'value' cannot convert into integer");
    }
};

DataStream.prototype.write = function (value, type) {
    return convertByteArray(value, type).every((v) => this.put(v));
};

DataStream.prototype.toHex = function () {
    return Buffer(this.data.slice(0, this.pos)).toString("hex");
};

DataStream.from = function (value, type) {
    const data = convertByteArray(value, type);
    const ds = new DataStream(data.length);
    ds.write(data);
    return ds;
};

DataStream.fromHex = function (hex) {
    hex = hex.replace(/^0x/, "");
    const size = hex.length / 2;
    if (!Number.isSafeInteger(size)) {
        throw new Error("the length of 'hex' is invalid");
    }

    const data = Array.from({length: size}, (v, i) => Number("0x" + hex.slice(i * 2, (i + 1) * 2)));
    return DataStream.from(data);
};

const trx_type = {
    expiration: "TimePointSec",
    ref_block_num: "Uint(16)",
    ref_block_prefix: "Uint(32)",
    max_net_usage_words: "UnsignedInt",
    max_cpu_usage_ms: "Uint(8)",
    delay_sec: "UnsignedInt",
    context_free_actions: `vector<Action>`,
    actions: `vector<Action>`,
    transaction_extensions: `vector<tuple<Uint(16),vector<Int(8)>>>` ///`vector<Int(8)>` ///
};

const transfer_data_type = "tuple<Name, Name, Asset, StringType>";
const action_data = ["mokemokecore", "leohioleohio", "1.0000 EOS", "send EOS"];
const packed_action_data = convertByteArray(action_data, transfer_data_type);

const trx = {
    expiration: "2019-04-14T19:02:17",
    ref_block_num: 25519,
    ref_block_prefix: 2677444921,
    max_net_usage_words: 0,
    max_cpu_usage_ms: 0,
    delay_sec: 0,
    context_free_actions: [],
    actions: [{
        account: "eosio.token",
        name: "transfer",
        authorization: [{actor: "mokemokecore", permission: "active"}],
        data: packed_action_data
    }],
    transaction_extensions: [],
};

/// packed trx
const packed_trx = DataStream.from(trx, trx_type);
// console.log(packed_trx.data);
// console.log(packed_trx.toHex()); /// -> "b983b35caf633991969f000000000100a6823403ea3055000000572d3ccdcd01a02e450a52a9209500000000a8ed323229a02e450a52a92095405da32a52d7a88a102700000000000004454f53000000000873656e6420454f5300"

module.exports = { DataStream, toBI, toSI, Uint, Int, UnsignedInt, SymbolCode, SymbolType, Asset, Name, PermissionLevel, Action, TimePointSec, StringType, Extension, packActionData, convertByteArray };
