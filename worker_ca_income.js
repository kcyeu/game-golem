/*jslint browser:true, laxbreak:true, forin:true, sub:true, onevar:true, undef:true, eqeqeq:true, regexp:false */
/*global
	$, Workers, Worker, Config, Dashboard, History,
	Bank, Generals, Player,
	APP, APPID, PREFIX, log, debug, userID, imagepath,
	isRelease, version, revision, Images, window, browser,
	LOG_ERROR, LOG_WARN, LOG_LOG, LOG_INFO, LOG_DEBUG, log,
	QUEUE_CONTINUE, QUEUE_RELEASE, QUEUE_FINISH,
	isArray, isFunction, isNumber, isObject, isString, isWorker
*/
/********** Worker.Income **********
* Auto-general for Income, also optional bank
* User selectable safety margin - at default 5 sec trigger it can take up to 14 seconds (+ netlag) to change
*/
var Income = new Worker('Income');
Income.data = Income.runtime = null;

Income.settings = {
	important:true,
	taint:true
};

Income.defaults['castle_age'] = {};

Income.option = {
	general:true,
	bank:true,
	margin:45
};

Income.temp = {
	income:false,
	bank:false
};

Income.display = [
	{
		id:'general',
		label:'Use Best General',
		checkbox:true
	},{
		id:'bank',
		label:'Automatically Bank',
		checkbox:true
	},{
		advanced:true,
		id:'margin',
		label:'Safety Margin',
		select:[15,30,45,60],
		suffix:'seconds'
	}
];

Income.init = function(event) {
	this._watch(Player, 'data.cash_time');
};

Income.update = function(event) {
	var income = Player.get('income', 0), when = Player.get('cash_timer', 9999) - this.option.margin;
	if (when > 0) {
		this._remind(when, 'income');
	}
	if ((this.set(['temp','income'], when <= 0))) {
		this.set(['temp','bank'], true);
	}
	Dashboard.status(this, Config.makeImage('gold') + '$' + (income + History.get('income.average.24')).round(0).addCommas() + ' per hour (' + Config.makeImage('gold') + '$' + income.addCommas() + ' from land, ' + ((Player.get('upkeep', 0) / Player.get('maxincome', 1)) * 100).round(2) + '% upkeep)');
	this.set(['option','_sleep'], !(this.option.general && this.temp.income) && !(this.option.bank && this.temp.bank));
};

Income.work = function(state) {
	if (state) {
		if (this.temp.income) {
			if (Generals.to('income')) {
				log(LOG_INFO, 'Waiting for Income... (' + Player.get('cash_timer') + ' seconds)');
			}
		} else if (this.temp.bank) {
			if (!Bank.stash()) {
				log(LOG_INFO, 'Banking Income...');
			} else {
				this.set(['temp','bank'], false);
			}
		}
	}
	return QUEUE_CONTINUE;
};

