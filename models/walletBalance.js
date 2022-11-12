const mongoose = require("mongoose");
const walletBalanceSchema = new mongoose.Schema({
    address: String,
    Year: Number,
    Month: Number,
    date: Number,
    balance:Number,
});
const WalletBalance = mongoose.model("WalletBalance", walletBalanceSchema);
module.exports = WalletBalance;
