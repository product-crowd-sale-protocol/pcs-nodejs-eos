'use strict'

const URL = require('url').URL;
const ecc = require('eosjs-ecc');
const { getSubsigMessage } = require("./pcs-sig");

class PCSServer {
    constructor(new_aws_api, aws_security_api, contract_name) {
        this.new_aws_api = new_aws_api;
        this.aws_security_api = aws_security_api;
        this.contract_name = contract_name;
    }

    async checkByPCSSecurity(symbol, tokenId, sig, message) {
        const url = this.aws_security_api + "/pcssecurity";

        const payload = {
            "name": "checkSig",
            "symbol": symbol,
            "tokenId": tokenId,
            "contract": this.contract_name,
            "sig": sig,
            "message": message
        };

        const req = {
            method: "POST",
            mode: "cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(payload)
        };

        const res = await fetch(url, req);

        if (res.status !== 200) {
            throw new Error(res);
        }

        try {
            const data = await res.json();
            const success = data.verify;
            return success;
        } catch (err) {
            console.error(err);
            return false;
        }
    }

    async requestSignTransaction(query) {
        const url = this.aws_security_api + "/eosagent"
        const options = {
            method: "POST",
            body: JSON.stringify(query)
        };

        const res = await fetch(url, options);
        if (res.status !== 200) {
            throw new Error(res);
        }

        const data = await res.json();
        console.log(data);

        if (data.errorMessage) {
            console.error(data.errorMessage);
            throw new Error(`the request to ${url} is failed`);
        }

        try {
            const signed_trx = data.signedTransaction.transaction;
            return signed_trx;
        } catch (error) {
            console.error(error);
        }
    }

    async genSalt(password, symbol, token_id) {
        const seedHash = ecc.sha256(password);
        console.log(this.new_aws_api);
        const url = this.new_aws_api + `?tokenId=${token_id}&hash=${seedHash}&symbol=${symbol}`;
        console.log(url);

        let res;
        try {
            res = await fetch(url, { method: "GET", mode: "cors" });
        } catch (err) {
            console.error(err);
        }

        if (res.status !== 200) {
            console.error(res);
            throw new Error(res);
        }

        try {
            console.log(res);
            const data = await res.json();
            const salt = data.body;
            return salt;
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * Generate Subsig key pair from nftId & password
     * @param {string} symbol token symbol
     * @param {number} token_id token id
     * @param {string} password password
     */
    async passwordToKey(symbol, token_id, password) {
        const salt = await this.genSalt(password, symbol, token_id); // generate secure salt using our server
        const private_key = ecc.seedPrivate(password + salt); // e.g. 5K2YUVmWfxbmvsNxCsfvArXdGXm7d5DC9pn4yD75k2UaSYgkXTh
        return private_key;
    }

    /**
     * check privatekey is valid by our server
     * @param {number} tokenId nft id
     * @param {string} privateKey  subsig private key
     */
    async verifyAuth(sym, token_id, private_key) {
        const message = getSubsigMessage();
        const sig = ecc.sign(message, private_key);
        console.log("sig", sig);

        const url = "https://pcs-api.toycash.io/verify";
        console.log("url", url);

        const query = {
            "api_url": "https://api-kylin.eoslaomao.com:443",
            "contract_name": "pcscoreprtcl",
            "symbol_code": sym,
            "token_id": token_id,
            "sig": sig
        };

        const headers = new Headers();
        headers.append("Content-Type", "application/json");

        const req = {
            method: "POST",
            mode: "cors",
            headers: headers,
            body: JSON.stringify(query)
        };

        const res = await fetch(url, req);
        console.log(res);
        if (res.status !== 200) {
            throw new Error(res);
        }

        try {
            const data = await res.text();
            console.log(data);
            return data === "verified";
        } catch (err) {
            console.error(err);
            return false;
        }

        // return await this.checkByPCSSecurity(sym, token_id, sig, message);
    }
}

module.exports = PCSServer;
