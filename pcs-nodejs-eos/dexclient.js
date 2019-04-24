'use strict'

const Eos = require("eosjs");
const ecc = require("eosjs-ecc");
const EOSTableAPI = require("./eos-table");
const PCSServer = require("./server");
const { Asset, PermissionLevel } = require("./types");
const { getSigTimestamp,
        getNameValue,
        getSymbolCodeRaw,
        uint64ToBuffer } = require("./subsig");



class PCSClient {
    constructor(
        private_keys,
        eos_api_url,
        eos_chain_id,
        contract_name,
        account_name,
        account_authority,
        new_aws_api,
        aws_security_api
    ) {
        this.contract_name = contract_name;
        this.account = {
            actor: account_name,
            permission: account_authority,
        };

        this.eosJS = Eos({
            keyProvider: private_keys,
            httpEndpoint: eos_api_url,
            chainId: eos_chain_id
        });
        this.eosTable = new EOSTableAPI(eos_api_url, contract_name);
    }

    /**
     * [transferEOS description]
     * @param  {PermissionLevel} from_account [description]
     * @param  {string} to           [description]
     * @param  {Asset} quantity     [description]
     * @param  {[type]} memo         [description]
     * @return {[type]}              [description]
     */
    transferEOS(from_account, to, quantity, memo) {
        if (!PermissionLevel.isValid(from_account)) {
            throw new Error("'from_account' is not PermissionLevel type");
        }

        if (!Name.isValid(to)) {
            throw new Error("'to' is not Name type");
        }

        if (!Asset.isValid(quantity)) {
            throw new Error("'quantity' is not Asset type");
        }

        memo = String(memo);

        const from = from_account.actor;
        return {
            account: "eosio.token",
            name: "transfer",
            authorization: [from_account],
            data: { from, to, quantity, memo }
        };
    }

    /**
     * create sell order
     * @param {string} sym - Token symbol
     * @param {number|string|BigInteger} toke_id - Token ID
     * @param {number|string|BigInteger} price_amount - Token Price by EOS amount
     * @param {string} memo - Data that can be written as the user likes.
     */
    async addSellOrderById(sym, token_id, price_amount, memo="add sell order by id") {
        const price = Asset({
            amount: price_amount,
            symbol: {
                symbol_code: "EOS",
                precision: 4
            }
        }).toString();
        const action = {
            account: this.contract_name,
            name: "addsellobyid",
            authorization: [this.account],
            data: { sym, token_id, price, memo },
        };
        const actions = [action];
        console.log(actions);

        return this.eosJS.transaction({actions});
    }

    /**
     * Buy Token from sell order
     * @param {string} sym - Token symbol
     * @param {number|string|BigInteger} token_id - Token ID in sell order table
     */
    async buyFromOrder(sym, token_id) {
        // get sell order infomation from EOS
        const { seller, price } = await this.getSellInfo(sym, token_id);
        const buyer = this.account.actor;
        const memo = `buy token from ${seller}`;
        const action1 = transferEOS(
            this.account,
            this.contract_name,
            price,
            "deposit EOS to buy token from order");
        const action2 = {
            account: this.contract_name,
            name: "buyfromorder",
            authorization: [this.account],
            data: { buyer, sym, token_id, memo }
        };
        const actions = [action1, action2];
        console.log(actions);

        return this.eosJS.transaction({actions});
    }

}

module.exports = PCSDex;
