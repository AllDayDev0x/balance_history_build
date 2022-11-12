const mongoose = require("mongoose");
const Schema = new mongoose.Schema({
    totalEthBalance: Number,
    totalUSDBalance: Number,
    Year: Number,
    Month: Number,
    date: Number,
});
const startBalance = mongoose.model("StartBalance", Schema);
module.exports = startBalance;
