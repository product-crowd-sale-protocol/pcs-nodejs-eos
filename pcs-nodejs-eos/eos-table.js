'use strict'

class EOSTableAPI {
    constructor(eos_api_url, contract_name) {
        this.eos_api_url = eos_api_url;
        this.contract_name = contract_name;
    }

    /**
     * fetch information from EOS contract table
     * @param {Object} query - Request to fetch information from EOS table
     * @param {string} query.code - Target contract name
     * @param {string} query.scope - Target scope name
     * @param {string} query.table - Target table name
     * @param {string} query.lower_bound - Sort key min limit --optional
     * @param {string} query.upper_bound - Sort key max limit --optional
     * @param {string} query.limit - Query limit [0, 100] --optional
     * There are many other parameters. Read the official EOS documentation.
     */
    async getTable(query) {
        const url = this.eos_api_url + "/v1/chain/get_table_rows";
        const req = {
            method: "POST",
            mode: "cors",
            body: JSON.stringify({ "json": true, ...query })
        };

        let response = await fetch(url, req);
        let result = await response.json();
        return result;
    }

    /**
     * fetch token information from EOS table
     * @param {string} sym community symbol
     * @param {number} token_id nft id
     */
    async getTokenTable(sym) {
        const query = {
            "code": this.contract_name,
            "scope": sym,
            "table": "token",
            "limit": 100,
            "reverse": true,
        };
        const response = await this.getTable(query);
        return response.rows;
    }

    /**
     * fetch token information from EOS table
     * @param {string} sym community symbol
     * @param {number} token_id nft id
     */
    async getTokenInfo(sym, token_id) {
        const query = {
            "code": this.contract_name,
            "scope": sym,
            "table": "token",
            "lower_bound": token_id,
            "upper_bound": token_id
        };
        const response = await this.getTable(query);

        if (response.rows.length === 1) {
            return response.rows[0];  // e.g: {id: 0, subkey: "EOS11...", owner: "toycashio123", active: 1}
        } else {
            console.error("対応するトークンが存在しません。");
            return null;
        }
    }

    async getAvailableTokenId(sym) {
        const query = {
            "code": this.contract_name,
            "scope": sym,
            "table": "token",
            "limit": 1,
            "reverse": true,
        };
        const response = await this.getTable(query);

        if (response.rows.length > 0) {
            const BigInteger = require('bigi');
            const last_token_id = new BigInteger(String(response.rows[0].id));
            return last_token_id.add(new BigInteger("1")).toString();
        } else {
            return new BigInteger(0);
        }
    }

    async existSymbol(sym) {
        const query = {
            "code": this.contract_name,
            "scope": this.contract_name,
            "table": "currency",
            "lower_bound": sym,
            "upper_bound": sym
        };
        const response = await this.getTable(query);

        if (response.rows.length > 0) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * fetch token's subsig public key and owner account name from EOS contract table
     * @param {number} nftId nft id
     */
    async getEOSAuth(sym, nftId) {
        const query = {
            "code": this.contract_name,
            "scope": sym,
            "table": "token",
            "lower_bound": nftId,
            "upper_bound": nftId
        };
        console.log(query);
        let response = await this.getTable(query);
        console.log(response);
        let rows = response.rows;
        if (rows.length === 0) {
            throw new ReferenceError("token with id not found");
        }

        let owner = rows[0].owner;
        let subkey = rows[0].subkey;
        let result = { "account": owner, "subkey": subkey };
        return result;
    }
}

module.exports = EOSTableAPI;
