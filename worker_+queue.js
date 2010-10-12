/*jslint browser:true, laxbreak:true, forin:true, sub:true, onevar:true, undef:true, eqeqeq:true, regexp:false */
/*global
	$, Worker, Army, Config, Dashboard, History, Page, Queue:true, Resources, Window,
	Battle, Generals, LevelUp, Player,
	APP, APPID, log, debug, userID, imagepath, isRelease, version, revision, Workers, PREFIX, Images, window, browser,
	makeTimer, shortNumber, WorkerByName, WorkerById, Divisor, length, unique, deleteElement, sum, addCommas, findInArray, findInObject, objectIndex, sortObject, getAttDef, tr, th, td, isArray, isObject, isFunction, isNumber, isString, isWorker, plural, makeTime, ucfirst, ucwords,
	makeImage
*/
/********** Worker.Queue() **********
* Keeps track of the worker queue
*/
var Queue = new Worker('Queue', '*');
Queue.data = null;

// worker.work() return values for stateful - ie, only let other things interrupt when it's "safe"
var QUEUE_FINISH	= 0;// Finished everything, let something else work
var QUEUE_CONTINUE	= 1;// Not finished at all, don't interrupt
var QUEUE_RELEASE	= 2;// Not quite finished, but safe to interrupt 
// worker.work() can also return true/false for "continue"/"finish" - which means they can be interrupted at any time

Queue.settings = {
	system:true,
	unsortable:true,
	keep:true
};

Queue.runtime = {
	current:null
};

Queue.option = {
	delay: 5,
	clickdelay: 5,
	queue: ['Page', 'Resources', 'Queue', 'Settings', 'Title', 'Income', 'LevelUp', 'Elite', 'Quest', 'Monster', 'Battle', 'Arena', 'Heal', 'Land', 'Town', 'Bank', 'Alchemy', 'Blessing', 'Gift', 'Upgrade', 'Potions', 'Army', 'Idle'],//Must match worker names exactly - even by case
	enabled: {},// Automatically filled with everything anyway...
	start_stamina: 0,
	stamina: 0,
	start_energy: 0,
	energy: 0,
	quest: false, // Use for name of quest if over-riding quest
	general : false, // If necessary to specify a multiple general for attack
	action: false, // Level up action
	forceenergy: false, // Used to signal workers to ignore wait conditions to burn energy
	forcestamina: false, // Used to signal workers to ignore wait conditions and burn stamina
	pause: false
};

Queue.display = [
	{
		label:'Drag the unlocked panels into the order you wish them run.'
	},{
		id:'delay',
		label:'Delay Between Events',
		text:true,
		after:'secs',
		size:3
	},{
		id:'clickdelay',
		label:'Delay After Mouse Click',
		text:true,
		after:'secs',
		size:3,
		help:'This should be a multiple of Event Delay'
	},{
		id:'stamina',
		before:'Keep',
		select:'stamina',
		after:'Stamina Always'
	},{
		id:'start_stamina',
		before:'Stock Up',
		select:'stamina',
		after:'Stamina Before Using'
	},{
		id:'energy',
		before:'Keep',
		select:'energy',
		after:'Energy Always'
	},{
		id:'start_energy',
		before:'Stock Up',
		select:'energy',
		after:'Energy Before Using'
	}
];

Queue.runfirst = [];
Queue.lastclick = Date.now();	// Last mouse click - don't interrupt the player
Queue.lastrun = Date.now();		// Last time we ran
Queue.burn = {stamina:false, energy:false};
Queue.timer = null;

Queue.lasttimer = -1;

Queue.init = function() {
	var i, $btn, worker;
	this._watch(Player);
	this.option.queue = unique(this.option.queue);
	for (i in Workers) {// Add any new workers that have a display (ie, sortable)
		if (Workers[i].work && Workers[i].display && !findInArray(this.option.queue, i)) {
			log('Adding '+i+' to Queue');
			if (Workers[i].settings.unsortable) {
				this.option.queue.unshift(i);
			} else {
				this.option.queue.push(i);
			}
		}
	}
	for (i=0; i<this.option.queue.length; i++) {// Then put them in saved order
		worker = Workers[this.option.queue[i]];
		if (worker && worker.display) {
			if (this.runtime.current && worker.name === this.runtime.current) {
				debug('Trigger '+worker.name+' (continue after load)');
				$('#'+worker.id+' > h3').css('font-weight', 'bold');
			}
			$('#golem_config').append($('#'+worker.id));
		}
	}
	$(document).bind('click keypress', function(event){
		if (!event.target || !$(event.target).parents().is('#golem_config_frame,#golem-dashboard')) {
			Queue.lastclick=Date.now();
		}
	});
	$btn = $('<img class="golem-button' + (this.option.pause?' red':' green') + '" id="golem_pause" src="' + (this.option.pause ? Images.play : Images.pause) + '">').click(function() {
		Queue.option.pause = !Queue.option.pause;
		debug('State: ' + (Queue.option.pause ? "paused" : "running"));
		$(this).toggleClass('red green').attr('src', (Queue.option.pause ? Images.play : Images.pause));
		Page.clear();
		Queue.clearCurrent();
		Config.updateOptions();
	});
	$('#golem_buttons').prepend($btn); // Make sure it comes first
	// Running the queue every second, options within it give more delay
};

Queue.clearCurrent = function() {
	var current = this.get('runtime.current', null);
//	if (current) {
		$('#golem_config > div > h3').css('font-weight', 'normal');
		this.set('runtime.current', null);// Make sure we deal with changed circumstances
//	}
};

Queue.update = function(type,worker) {
	var i, $worker, worker, current, result, now = Date.now(), next = null, release = false, ensta = ['energy','stamina'], action;
	if (!type || type === 'option') { // options have changed
		if (this.option.pause) {
			this._forget('run');
			this.lasttimer = -1;
		} else if (this.option.delay !== this.lasttimer) {
			this._revive(this.option.delay, 'run');
			this.lasttimer = this.option.delay;
		}
		for (i in Workers) {
			$worker = $('#'+Workers[i].id+' .golem-panel-header');
			if (Queue.enabled(Workers[i])) {
				if ($worker.hasClass('red')) {
					$worker.removeClass('red');
					Workers[i]._update('option', null);
				}
			} else {
				if (!$worker.hasClass('red')) {
					$worker.addClass('red');
					Workers[i]._update('option', null);
				}
			}
		}
	}
	if (!type || type === 'runtime') { // runtime has changed - only care if the current worker isn't enabled any more
		if (this.runtime.current && !this.get(['option', 'enabled', this.runtime.current], true)) {
			this.clearCurrent();
		}
	}
	if (type === 'reminder') { // This is where we call worker.work() for everyone
		if ((isWorker(Window) && !Window.active) // Disabled tabs don't get to do anything!!!
		|| now - this.lastclick < this.option.clickdelay * 1000 // Want to make sure we delay after a click
		|| Page.loading) { // We want to wait xx seconds after the page has loaded
			return;
		}

		this.burn.stamina = this.burn.energy = 0;
		this.runtime.levelup = this.runtime.basehit = this.runtime.quest = this.runtime.general = this.burn.forcestamina = this.burn.forceenergy = false;
		for (i in ensta) {
			if (Player.get(ensta[i]) >= Player.get('max'+ensta[i])) {
				debug('At max ' + ensta[i] + ', burning ' + ensta[i] + ' first.');
				// Change later to Queue.stamina.burn and Queue.stamina.force
				this.burn[ensta[i]] = Player.get(ensta[i]);
				this.burn['force' + ensta[i]] = true;
				break;
			}
		}
		if (this.enabled(LevelUp) && !this.burn.stamina && !this.burn.energy 
				 && LevelUp.get('exp_possible') > Player.get('exp_needed')) {
			action = LevelUp.runtime.action = LevelUp.findAction('best', Player.get('energy'), Player.get('stamina'), Player.get('exp_needed'));
			if (action) {
				this.burn.energy = action.energy;
				this.burn.stamina = action.stamina;
				this.runtime.levelup = true;
				mode = (action.energy ? 'defend' : 'attack');
				stat = (action.energy ? 'energy' : 'stamina');
				if (action.quest) {
					this.runtime.quest = action.quest;
				}
				if (action.big) {
					this.runtime.general = action.general || (LevelUp.option.general === 'any' 
							? false 
							: LevelUp.option.general === 'Manual' 
							? LevelUp.option.general_choice
							: LevelUp.option.general );
				} else if (action.basehit === action[stat] && !Monster.get('option.best_'+mode) && Monster.get('option.general_' + mode) in Generals.get('runtime.multipliers')) {
					debug('Overriding manual general that multiplies attack/defense');
					this.runtime.general = (action.stamina ? 'monster_attack' : 'monster_defend');
				}
				this.runtime.basehit = action.basehit;
				Queue.burn.forcestamina = (action.stamina !== 0);
				Queue.burn.forceenergy = (action.energy !== 0);
				debug('Leveling up: force burn ' + (this.burn.stamina ? 'stamina' : 'energy') + ' ' + (this.burn.stamina || this.burn.energy));
				//debug('Level up general ' + this.runtime.general + ' base ' + this.runtime.basehit + ' action[stat] ' + action[stat] + ' best ' + !Monster.get('option.best_'+mode) + ' muly ' + (Monster.get('option.general_' + mode) in Generals.get('runtime.multipliers')));
				LevelUp.runtime.running = true;
			}
		} else {
			LevelUp.runtime.running = false;
		}
		if (!this.burn.stamina && !this.burn.energy) {
			if (this.option.burn_stamina || Player.get('stamina') >= this.option.start_stamina) {
				this.burn.stamina = Math.max(0, Player.get('stamina') - this.option.stamina);
				this.option.burn_stamina = this.burn.stamina > 0;
			}
			if (this.option.burn_energy || Player.get('energy') >= this.option.start_energy) {
				this.burn.energy = Math.max(0, Player.get('energy') - this.option.energy);
				this.option.burn_energy = this.burn.energy > 0;
			}
		} else {
			if (this.burn.forcestamina && Player.get('health') < 13) {
				LevelUp.runtime.heal_me = true;
			}
		}
		this._push();
		for (i in Workers) { // Run any workers that don't have a display, can never get focus!!
			if (Workers[i].work && !Workers[i].display && this.enabled(Workers[i])) {
				debug(Workers[i].name + '.work(false);');
				Workers[i]._unflush();
				Workers[i]._work(false);
			}
		}
		for (i=0; i<this.option.queue.length; i++) {
			worker = Workers[this.option.queue[i]];
			if (!worker || !worker.work || !worker.display || !this.enabled(worker)) {
				continue;
			}
//			debug(worker.name + '.work(' + (this.runtime.current === worker.name) + ');');
			if (this.runtime.current === worker.name) {
				worker._unflush();
				result = worker._work(true);
				if (result === QUEUE_RELEASE) {
					release = true;
				} else if (!result) {// false or QUEUE_FINISH
					this.runtime.current = null;
					if (worker.id) {
						$('#'+worker.id+' > h3').css('font-weight', 'normal');
					}
//					debug('End '+worker.name);
				}
			} else {
				result = worker._work(false);
			}
			if (!worker.settings.stateful && typeof result !== 'boolean') {// QUEUE_* are all numbers
				worker.settings.stateful = true;
			}
			if (!next && result) {
				next = worker; // the worker who wants to take over
			}
		}
		current = this.runtime.current ? Workers[this.runtime.current] : null;
		if (next !== current && (!current || !current.settings.stateful || next.settings.important || release)) {// Something wants to interrupt...
			if (current) {
				debug('Interrupt ' + current.name + ' with ' + next.name);
				if (current.id) {
					$('#'+current.id+' > h3').css('font-weight', 'normal');
				}
			} else {
				debug('Trigger ' + next.name);
			}
			this.runtime.current = next.name;
			if (next.id) {
				$('#'+next.id+' > h3').css('font-weight', 'bold');
			}
		}
//		debug('End Queue');
		for (i in Workers) {
			Workers[i]._flush();
		}
		this._pop();
	}
};

Queue.enabled = function(worker) {
	try {
		return !(worker.name in this.option.enabled) || this.option.enabled[worker.name];
	} catch(e) {
		return isWorker(worker);
	}
};

