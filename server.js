const express = require("express");
const ws = require("ws");
const mongoose = require("mongoose");
const fs = require("fs");
const axios = require("axios");
const config = require("./config");
const Web3 = require("web3");
const PnlTrak = require("./models/PnlTrak");
const WalletBalance = require("./models/walletBalance");
const StartBalance = require("./models/Wallet");

const app = express();
const port = config.port;
let PNLItem = "D";
console.log("ok");
const web3 = new Web3(config.rpc.https);
let Year, Month;
let StartYear, StartMonth, StartDate;
let Data = {};
let TotalEthBalance;
let TotalUSDBalance;
let TokenBalance = { usdt: 0, usdc: 0, dai: 0 };
let DaysOfMonth = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
mongoose.connect("mongodb://localhost:27017/PnlTrack");

const tokenABI = [{
	"constant": true,
	"inputs": [
		{
			"internalType": "address",
			"name": "",
			"type": "address"
		}
	],
	"name": "balanceOf",
	"outputs": [
		{
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		}
	],
	"payable": false,
	"stateMutability": "view",
	"type": "function"
}];
const getUSD_Rate = async () => {
	let data = await axios.get(`https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${config.EtherScan_API_KEY}`);

	return data.data.result.ethusd * 1;
}
PnlTrak.findOne({ Year: new Date().getFullYear(), Month: new Date().getMonth() + 1, date: new Date().getDate() }).then(res => {
	if (res == null) {
		return;
	}
	TotalEthBalance = res.totalEthBalance;
	TotalUSDBalance = res.totalUSDBalance;
})
StartBalance.find({}).then(async (result) => {

	if (result.length == 0) {
		let promises = [];
		let nowDate = new Date();
		let balances = [];
		config.accounts.map((account, index) => {


			let promise = new Promise(async (resolve, reject) => {
				let balance = await web3.eth.getBalance(account) * 1;
				let walletBalance = new WalletBalance({
					Year: nowDate.getFullYear(),
					Month: nowDate.getMonth() + 1,
					date: nowDate.getDate(),
					address: account,
					balance: balance,
				});
				walletBalance.save();
				balances.push(balance);
				resolve();

			});
			promises.push(promise);

		});

		let USD_rate;
		promises.push(new Promise(async (resolve, reject) => {
			USD_rate = await getUSD_Rate();
			resolve();
		}))
		await Promise.all(promises);
		let totalEthBalance = 0;
		balances.map(balance => {
			totalEthBalance += balance;
		});
		let totalUSDBalance = (totalEthBalance / 10 ** 18 * USD_rate).toFixed(0) * 1;
		totalEthBalance = (totalEthBalance / 10 ** 18).toFixed(4) * 1;
		console.log(totalEthBalance, USD_rate, "balances")

		let startBalance = new StartBalance({
			totalEthBalance: totalEthBalance,
			totalUSDBalance,
			Year: nowDate.getFullYear(),
			Month: nowDate.getMonth() + 1,
			date: nowDate.getDate(),

		})
		await startBalance.save();
		TotalEthBalance = totalEthBalance;
		TotalUSDBalance = totalUSDBalance;

		let pnlTrack = new PnlTrak({
			Year: nowDate.getFullYear(),
			Month: nowDate.getMonth() + 1,
			date: nowDate.getDate(),
			totalEthBalance: totalEthBalance,
			totalUSDBalance: totalUSDBalance,
			EPnl: 0, //Ether Pnl
			DPnl: 0, //Dollar Pnl
		})
		await pnlTrack.save();
		StartYear = pnlTrack.Year;
		StartMonth = pnlTrack.Month;
		StartDate = pnlTrack.date;
	}
	else {
		RealTimeFunction()
		StartYear = result[0].Year;
		StartMonth = result[0].Month;
		StartDate = result[0].date;
	}
});
;
const RealTimeFunction = async () => {
	// console.error("dd")
	let promises = [];
	let nowDate = new Date();
	let balances = [];
	config.accounts.map((account, index) => {

		let promise = new Promise(async (resolve, reject) => {
			let balance = await web3.eth.getBalance(account) * 1;
			let walletBalance = await WalletBalance.findOne({ Year: nowDate.getFullYear(), Month: nowDate.getMonth() + 1, date: nowDate.getDate(), address: account });
			// console.log({ Year: nowDate.Year, Month: nowDate.getMonth() + 1, date: nowDate.getDate(), address: account })
			if (!walletBalance) {
				// console.log("create")
				walletBalance = new WalletBalance({
					Year: nowDate.getFullYear(),
					Month: nowDate.getMonth() + 1,
					date: nowDate.getDate(),
					address: account,
					balance: balance,
				});
			}
			else {
				// console.log("update")
				walletBalance.balance = balance;
			}
			await walletBalance.save();
			balances.push(balance);
			resolve();

		});
		promises.push(promise);

	});


	await Promise.all(promises);
	let totalEthBalance = 0;
	balances.map(balance => {
		totalEthBalance += balance;
	});
	// console.log(145)
	let USD_rate = await getUSD_Rate();
	// console.log(USD_rate)
	let totalUSDBalance = (totalEthBalance / 10 ** 18 * USD_rate).toFixed(0) * 1;
	totalEthBalance = (totalEthBalance / 10 ** 18).toFixed(4) * 1
	// console.log(totalEthBalance, totalUSDBalance);
	let beforeDateBalance;
	// console.log("start",StartYear, StartMonth, StartDate)
	if (nowDate.getFullYear() == StartYear && nowDate.getMonth() + 1 == StartMonth && nowDate.getDate() == StartDate) {
		beforeDateBalance = await StartBalance.find({});
	} else {
		if (nowDate.getDate() == 1) {
			if (nowDate.getMonth() == 0) {

				beforeDateBalance = await PnlTrak.find({ Year: nowDate.getFullYear() - 1, Month: 12 }).sort({ date: -1 }).limit(1);
			} else {


				beforeDateBalance = await PnlTrak.find({ Year: nowDate.getFullYear(), Month: { $lt: nowDate.getMonth() + 1 } }).sort({ date: -1 }).limit(1);
			}
		} else {

			beforeDateBalance = await PnlTrak.find({ Year: nowDate.getFullYear(), Month: nowDate.getMonth() + 1, date: { $lt: nowDate.getDate() } }).sort({ date: -1 }).limit(1);

		}
	}
	beforeDateBalance =beforeDateBalance[0];
	let EPnl = totalEthBalance - beforeDateBalance.totalEthBalance;
	let DPnl = totalUSDBalance - beforeDateBalance.totalUSDBalance;

	let pnlTrack = await PnlTrak.findOne(
		{
			Year: nowDate.getFullYear(),
			Month: nowDate.getMonth() + 1,
			date: nowDate.getDate(),

		}
	);
	if (!pnlTrack) {
		let pnlTrack = new PnlTrak({
			Year: nowDate.getFullYear(),
			Month: nowDate.getMonth() + 1,
			date: nowDate.getDate(),
			EPnl,
			DPnl,
			totalEthBalance,
			totalUSDBalance
		});
		pnlTrack.save();
	} else {
		pnlTrack.totalEthBalance = totalEthBalance;
		pnlTrack.totalUSDBalance = totalUSDBalance;
		pnlTrack.EPnl = EPnl;
		pnlTrack.DPnl = DPnl;
		pnlTrack.save();
	}
	TotalEthBalance = totalEthBalance;
	TotalUSDBalance = totalUSDBalance;
	let tokenBalances = []
	const usdtContract = new web3.eth.Contract(tokenABI, config.usdtAddy);
	const usdcContract = new web3.eth.Contract(tokenABI, config.usdcAddy);
	const daiContract = new web3.eth.Contract(tokenABI, config.daiAddy);
	let tokenPromises = [];
	config.accounts.map((account, index) => {


		let promise = new Promise(async (resolve, reject) => {
			tokenBalances[index] = {};
			tokenBalances[index].usdt = parseInt(await usdtContract.methods.balanceOf(account).call() /10**6);
			tokenBalances[index].usdc =parseInt( await usdcContract.methods.balanceOf(account).call()/10**6);
			tokenBalances[index].dai = parseInt(await daiContract.methods.balanceOf(account).call()/10**6);
			// console.log(tokenBalances[index],"balance")
			resolve();
		});
		tokenPromises.push(promise);

	});
	await Promise.all(tokenPromises);
	TokenBalance = { usdt: 0, usdc: 0, dai: 0 };
	tokenBalances.map(item => {
		TokenBalance.usdt += item.usdt*1;
		TokenBalance.usdc += item.usdc*1;
		TokenBalance.dai += item.dai*1;
		
	})

	await getData();
	// console.error("dd")
	broadcast(JSON.stringify({ PNLItem, data: Data }))

}

setInterval(RealTimeFunction, 5 * 60 * 1000);
const getData = async () => {
	let nowDate = new Date();
	Data = {};
	if (!Year) return;
	if (PNLItem == "M") {
		if (Year < StartYear || Year >= nowDate) {
			Data.error = `This project was started since ${StartYear}-${StartMonth}-${StartDate}`;
		}
		const MonthPnlCollection = await PnlTrak.aggregate([
			{ $match: { Year: Year * 1 } },
			{ $sort: { date: -1, Month: 1 } },
			{
				$bucketAuto: {
					groupBy: "$Month",
					buckets: 12,
					output: {
						Year: { $first: "$Year" },

						date: { $first: "$date" },
						Month: { $first: "$Month" },
						totalEthBalance: { $first: "$totalEthBalance" },
						totalUSDBalance: { $first: "$totalUSDBalance" },
					}
				}
			}

		]);
		let beforeMonthBalance = {};
		if (Year == StartYear) {
			beforeMonthBalance = await StartBalance.findOne({});
		}
		else {
			beforeMonthBalance = await PnlTrak.find({ Year: { $lt: Year * 1 } }).sort({ date: -1, Month: -1, });
			beforeMonthBalance = beforeMonthBalance[0];
		}
		// console.log("befiore", beforeMonthBalance, MonthPnlCollection, Year, "monthly")
		let MonthlyPnl = [];
		MonthPnlCollection.map((MonthPnl, index) => {
			if (index != 0) {
				beforeMonthBalance = MonthPnlCollection[index - 1];
			}
			MonthlyPnl[index] = {
				EPnl: ((MonthPnl.totalEthBalance - beforeMonthBalance.totalEthBalance)).toFixed(4) * 1,
				DPnl: parseInt(MonthPnl.totalUSDBalance - beforeMonthBalance.totalUSDBalance),
				Month: MonthPnl.Month,
				Year: MonthPnl.Year,
				date: `${MonthPnl.Year}-${MonthPnl.Month}`
			}
		});
		// console.log(MonthlyPnl, Month, "monthlyPnl")
		let _startMonth = MonthlyPnl[0].Month;
		let _endMonth = MonthlyPnl[0].Month;
		for (let i = 1; i < _startMonth; i++) {
			MonthlyPnl.splice(0, 0, { EPnl: 0, DPnl: 0, date: `${Year}-${i}` });
		}

		for (let i = _endMonth + 1; i < 13; i++) {
			MonthlyPnl.push({ EPnl: 0, DPnl: 0, date: `${Year}-${i}` });
		}

		Data.data = MonthlyPnl;



	}
	else if (PNLItem == "D") {
		///daily pnl
		if (Year < StartYear || (Year == StartYear && Month < StartMonth)) {
			Data.error = `This project was started since ${StartYear}-${StartMonth}-${StartDate}`;
		}
		let DailyPnlCollection = await PnlTrak.find({ Year: Year * 1, Month: Month * 1 }).sort({ date: 1 });
		// let firstDate = DailyPnlCollection[0].date;
		// let DailyP
		// for(i = 1 ; i< firstDate; i++){

		// }
		let DailyPNL = [];
		DailyPnlCollection.map((DayPnl, index) => {

			DailyPNL.push({
				EPnl: DayPnl.EPnl,
				DPnl: DayPnl.DPnl,
				Month: DayPnl.Month,
				Year: DayPnl.Year,
				date: `${DayPnl.date}`
			});
		});
		let _startDate = 1;
		let lastDate = 12;
		// console.log(DailyPNL, "dailypnl");
		if (DailyPNL.length > 0) {
			_startDate = DailyPNL[0].date * 1;
			lastDate = DailyPNL[DailyPNL.length - 1].date * 1
		}
		if (_startDate > 1) {
			for (let i = 1; i < _startDate; i++) {
				DailyPNL.splice(0, 0, { EPnl: 0, DPnl: 0, date: `${i}` });
			}
		}


		if (lastDate < DaysOfMonth[Month]) {
			for (let i = lastDate + 1; i <= DaysOfMonth[Month]; i++) {
				DailyPNL.push({ EPnl: 0, DPnl: 0, date: `${i}` });
			}
		}
		Data.data = DailyPNL;

	}
	else if (PNLItem == "Y") {
		const YearlyPnlCollection = await PnlTrak.aggregate([
			{ $sort: { date: -1, Month: -1, Year: 1 } },
			{
				$bucketAuto: {
					groupBy: "$Year",
					buckets: 200,
					output: {

						Year: { $first: "$Year" },
						totalEthBalance: { $first: "$totalEthBalance" },
						totalUSDBalance: { $first: "$totalUSDBalance" },
					}
				}
			}
		]);
		let StartYearBalance = {};
		StartYearBalance = await StartBalance.findOne({});
		let YearlyPnl = [];
		// console.error("startYear", StartYearBalance, YearlyPnlCollection)
		YearlyPnlCollection.map((YearPnl, index) => {
			// console.log(StartYearBalance, YearPnl)
			if (index != 0) {
				StartYearBalance = YearlyPnlCollection[index - 1];
			}
			YearlyPnl[index] = {
				EPnl: ((YearPnl.totalEthBalance - StartYearBalance.totalEthBalance)).toFixed(4) * 1,
				DPnl: parseInt(YearPnl.totalUSDBalance - StartYearBalance.totalUSDBalance),
				Year: YearPnl.Year,
				date: YearPnl.Year
			}
			if (index == YearlyPnlCollection.length - 1) {
				YearlyPnl.push({ date: YearPnl.Year * 1 + 1 });
				YearlyPnl.push({ date: YearPnl.Year * 1 + 2 });
				YearlyPnl.push({ date: YearPnl.Year * 1 + 3 });
			}
		});
		Data.data = YearlyPnl;

	}
	Data.TotalEthBalance = TotalEthBalance;
	Data.TotalUSDBalance = TotalUSDBalance;
	Data.tokenBalance = TokenBalance;
	// console.log(Data, "data");
	Data.dailyPNL = await getDailyPNL();
	Data.monthlyPNL = await getMonthlyPNL();
	Data.yearlyPNL = await getYearlyPNL();
	return Data;
}


const getYearlyPNL = async ()=>{
	let nowDate = new Date();
	let beforeData = await PnlTrak.find({Year:{$lt : nowDate.getFullYear()}}).sort({
		date:-1, Month:-1, Year: -1
	});
console.log(beforeData,"test")
	if(beforeData.length ==0){
		beforeData = await StartBalance.findOne({});
	}
	else{

		beforeData = beforeData[0];
	}
	
	let nowData = await PnlTrak.findOne({Year:nowDate.getFullYear(), Month:nowDate.getMonth()+1, date: nowDate.getDate()});
	if(beforeData== null || nowData == null){
		console.error("error in getting Yearly Pnl");
	}
	return nowData.totalEthBalance - beforeData.totalEthBalance;
}
const getMonthlyPNL = async ()=>{
	let nowDate = new Date();
	let data = await PnlTrak.find({Year:nowDate.getFullYear(), Month: nowDate.getMonth()+1}).sort({date:1});
	return data[data.length -1].totalEthBalance - data[0].totalEthBalance + data[0].EPnl*1;

}
const getDailyPNL = async ()=>{
	let nowDate = new Date();
	let data = await PnlTrak.findOne({Year:nowDate.getFullYear(), Month:nowDate.getMonth() +1, date: nowDate.getDate()});
	return data.EPnl;
}

const wss = new ws.Server({ noServer: true });   // webSocket library
// const wssPort = 443;             // port number for the webSocket server
// const wss = new WebSocketServer({ port: wssPort }); // the webSocket server
var clients = new Array;         // list of client connections
var index = 0;
//console.log(WebSocketServer,"server")
function handleConnection(client, request) {
	index++;
	console.log("new Connection");

	clients.push(client);
	function endClient() {
		// console.log("end")
		var position = clients.indexOf(client);
		clients.splice(position, 1);
		// console.log("connection closed");
	}

	async function clientResponse(data) {
		index++;
		data = JSON.parse(data);
		Year = data.Year;
		Month = data.Month;
		PNLItem = data.PNLItem;
		// console.log(data, "client data")
		let sendData;
		if (data.PNLItem) {
			sendData = await getData();

		} else {
			return;
		}


		broadcast(JSON.stringify({ PNLItem, data: sendData }))
	}
	client.on('message', clientResponse);
	client.on('close', endClient);
}

function broadcast(data) {
	for (c in clients) {
		if (clients[c])
			clients[c].send(data);
	}
}
app.use(express.static(__dirname + '/build'));
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "./build/index.html"));
});
wss.on('connection', handleConnection);
const server = app.listen(port);
server.on("upgrade", (req, socket, head) => {
	wss.handleUpgrade(req, socket, head, socket => {
		wss.emit("connection", socket, req)
	})
})
console.log("Pnl track Started!");
