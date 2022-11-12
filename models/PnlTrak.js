const mongoose = require("mongoose");
const Schema = new mongoose.Schema({

    Year: Number,
    Month: Number,
    date: Number,
    totalEthBalance: Number,// Ether balance
    totalUSDBalance: Number,// Dollar balance
    EPnl: Number, //Ether Pnl
    DPnl: Number, //Dollar Pnl
});
const PnLTrak = mongoose.model("PnLTrak", Schema);
module.exports = PnLTrak;
