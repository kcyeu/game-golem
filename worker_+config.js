/*jslint browser:true, laxbreak:true, forin:true, sub:true, onevar:true, undef:true, eqeqeq:true, regexp:false */
/*global
	$, Workers, Worker, Queue, Script,
	APP, APPID, APPID_, APPNAME, PREFIX, userID, imagepath, isFacebook,
	isRelease, version, revision, Images, window, browser,
	LOG_ERROR, LOG_WARN, LOG_LOG, LOG_INFO, LOG_DEBUG, log,
	isArray, isFunction, isNumber, isObject, isString, isUndefined, isWorker,
	Divisor, getImage, isEvent
*/
/********** Worker.Config **********
* Has everything to do with the config
*/
var Config = new Worker('Config');

Config.settings = {
	system:true,
	keep:true,
	taint:true
};

Config.option = {
	display:true,
	fixed:false,
	advanced:false,
	debug:false,
	exploit:false
};

Config.temp = {
	require:[],
	menu:null
};

/** @this {Worker} */
Config.init = function(old_revision) {
	var i, j, k, tmp, worker, multi_change_fn;

	// START: Only safe place to put this - temporary for deleting old queue enabled code...
	if (old_revision <= 1106) { // Not sure real revision
		for (i in Workers) {
			if (Workers[i].option && Workers[i].option.hasOwnProperty('_enabled')) {
				if (!Workers[i].option._enabled) {
					Workers[i].set(['option','_disabled'], true);
				}
				Workers[i].set(['option','_enabled']);
			}
		}
	}
	// END

	// START: Move active (unfolded) workers into individual worker.option._config._show
	if (old_revision <= 1106) { // Not sure real revision
		if (this.option.active) {
			for (i=0; i<this.option.active.length; i++) {
				worker = Worker.find(this.option.active[i]);
				if (worker) {
					worker.set(['option','_config','_show'], true);
				}
			}
			this.set(['option','active']);
		}
	}
	// END

	// BEGIN: Changing this.option.display to a bool
	if (old_revision <= 1110) {
		this.option.display = (this.option.display === true || this.option.display === 'block');
	}
	// END

	this.makeWindow(); // Creates all UI stuff
	multi_change_fn = function(el) {
		var $this = $(el), tmp, worker, val;
		if ($this.attr('id')
		  && (tmp = $this.attr('id').slice(PREFIX.length).regex(/([^_]*)_(.*)/i))
		  && (worker = Worker.find(tmp[0]))
		) {
			val = [];
			$this.children().each(function(a,el){ val.push($(el).text()); });
			worker.set(['option', tmp[1]], val);
		}
	};

	$('input.golem_addselect').live('click.golem', function(){
		var i, value,
			values = $(this).prev().val().split(','),
			$multiple = $(this).parent().children().first();
		for (i=0; i<values.length; i++) {
			value = values[i].trim();
			if (value) {
				$multiple.append('<option>' + value + '</option>').change();
			}
		}
		multi_change_fn($multiple[0]);
//		Worker.flush();
	});
	$('input.golem_delselect').live('click.golem', function(){
		var $multiple = $(this).parent().children().first();
		$multiple.children().selected().remove();
		multi_change_fn($multiple[0]);
//		Worker.flush();
	});
	$('#golem_config input,textarea,select').live('change.golem', function(){
		var $this = $(this), tmp, worker, val, handled = false;
		if ($this.is('#golem_config :input:not(:button)')
		  && $this.attr('id')
		  && (tmp = $this.attr('id').slice(PREFIX.length).regex(/([^_]*)_(.*)/i))
		  && (worker = Worker.find(tmp[0]))
		) {
			if ($this.attr('type') === 'checkbox') {
				val = $this.prop('checked');
			} else if ($this.attr('multiple')) {
				multi_change_fn($this[0]);
				handled = true;
			} else {
				val = $this.prop('value') || $this.val() || null;
				if (val && val.search(/^[-+]?\d*\.?\d+$/) >= 0) {
					val = parseFloat(val);
				}
			}
			if (!handled) {
				worker.set('option.'+tmp[1], val, null);
//				Worker.flush();
			}
		}
	});
	$('#golem').append('<div id="golem-menu" class="golem-menu golem-shadow"></div>');
	$('.golem-menu > div').live('click.golem', function(event) {
		var $this = $(this.wrappedJSObject || this),
			key = $this.attr('name').regex(/^([^.]*)\.([^.]*)\.(.*)/),
			worker = Worker.find(key[0]);
		if (!isWorker(worker)) {
			log(LOG_WARN, 'Worker ' + key[0] + ' seems to have vanished!');
		} else if (!isFunction(worker.menu)) {
			log(LOG_WARN, worker.name + '.menu() seems to have vanished!');
		} else {
//			log(key[0] + '.menu(' + key[1] + ', ' + key[2] + ')');
			worker._unflush();
			try {
				worker.menu.call(worker, Worker.find(key[1]), key[2]);
			} catch (e) {
				log(e, e.name + ' in ' + worker.name + '.menu(' + key[1] + ',' + key[2] + '): ' + e.message);
			}
		}
//		Worker.flush();
	});
	$('.ui-accordion-header,.golem-panel-header').live('click', function(){
		$(this).blur();
	});
	$('body').live('click.golem', function(event){ // Any click hides it, relevant handling done above
		Config.set(['temp','menu']);
		$('.golem-icon-menu-active').removeClass('golem-icon-menu-active');
		$('#golem-menu').hide();
//		Worker.flush();
	});

	this._watch(this, 'data');
	this._watch(this, 'option.advanced');
	this._watch(this, 'option.debug');
	this._watch(this, 'option.exploit');
};

/** @this {Worker} */
Config.update = function(event, events) {
	var i, j, k, tmp, evt, worker, id, value, list,
		show = false, options = [], handled = {};

	for (j = 0; j < events.length; j++) {
		evt = events[j];
		if (isEvent(evt, this, 'init')) {
			for (id in this.data) {
				if (handled[id]) {
				    continue;
				}
				handled[id] = true;
				list = this.data[id];
				k = [];
				if (isArray(list)) {
					for (i = 0; i < list.length; i++) {
						k.push('<option value="'+list[i]+'">' + list[i] + '</option>');
					}
				} else if (isObject(list)) {
					for (i in list) {
						k.push('<option value="'+i+'">' + list[i] + '</option>');
					}
				}
				list = k.join('');
				tmp = $('.golem_'+id);
				for (i = 0; i < tmp.length; i++) {
					k = ($(tmp[i]).attr('id') || '').regex(/^golem\d+_([^_]+)_(.+)$/);
					worker = Worker.find(k[0]);
					value = worker ? worker.get(['option',k[1]]) : $(tmp[i]).val();
					$(tmp[i]).html(list).val(value);
				}
			}
			show = true;
		} else if (isEvent(evt, this, 'show')) {
			show = true;
		} else if (isEvent(evt, this, 'watch', 'option.advanced')
		  || isEvent(evt, this, 'watch', 'option.debug')
		  || isEvent(evt, this, 'watch', 'option.exploit')
		) {
			for (i in Workers) {
				if (Workers[i].settings.advanced
				  || Workers[i].settings.debug
				  || Workers[i].settings.exploit
				) {
					$('#'+Workers[i].id).css('display',
					  ((!Workers[i].settings.advanced || this.option.advanced)
					  && (!Workers[i].settings.debug || this.option.debug)
					  && (!Workers[i].settings.exploit || this.option.exploit))
					  ? '' : 'none');
				}
			}
		} else if (isEvent(evt, null, 'watch')) {
			worker = evt.worker;
			if ((k = evt.id) === 'option._config') {
				i = evt.path.slice(k.length + 1);
				if (i === '_show') {
					// Fold / unfold a config panel
					id = worker.id;
					value = 0;
				} else {
					// Fold / unfold a group panel
					id = worker.id + '_' + i;
					value = worker.get(evt.path) || 0;
				}
				if (value !== $('#'+id).accordion('option','active')) {
					$('#'+id).accordion('activate', value);
				}
			} else if (k === 'option._sleep') {
				// Show the ZZZ icon
//				log(LOG_LOG, worker.name + ' going to sleep...');
				$('#golem_sleep_' + worker.name).toggleClass('ui-helper-hidden', !worker.get(['option','_sleep']));
			} else if (k === 'data') {
				// Some option changed, so make sure we show that
				id = evt.path.slice(k.length + 1);
				if (id && !handled[id]) {
					handled[id] = true;
					list = this.data[id];
					k = [];
					if (isArray(list)) {
						for (i = 0; i < list.length; i++) {
							k.push('<option value="'+list[i]+'">' + list[i] + '</option>');
						}
					} else if (isObject(list)) {
						for (i in list) {
							k.push('<option value="'+i+'">' + list[i] + '</option>');
						}
					}
					list = k.join('');
					tmp = $('.golem_'+id);
					for (i = 0; i < tmp.length; i++) {
						k = ($(tmp[i]).attr('id') || '').regex(/^golem\d+_([^_]+)_(.+)$/);
						worker = Worker.find(k[0]);
						value = worker ? worker.get(['option',k[1]]) : $(tmp[i]).val();
						$(tmp[i]).html(list).val(value);
					}
				}
			}
		}
	}

	if (show) {
		if (this.option.display) {
			$('#golem_config').show();
		}
		// make sure everything is created before showing
		// (css sometimes takes another second to load though)
		$('#golem_config_frame').removeClass('ui-helper-hidden');
	}

	this.checkRequire();

	return true;
};

/** @this {Worker} */
Config.menu = function(worker, key) {
	if (!worker) {
		if (!key) {
			return [
				'fixed: ' + (this.option.fixed ? '<img src="' + getImage('pin_down') + '">Fixed' : '<img src="' + getImage('pin_left') + '">Normal') + '&nbsp;Position',
				'advanced:' + (this.option.advanced ? '+' : '-') + 'Advanced Options',
				'debug:' + (this.option.debug ? '+' : '-') + 'Debug Options'
			];
		} else if (key) {
			switch (key) {
				case 'fixed':
					$('#golem_config_frame').toggleClass('ui-helper-fixed', this.toggle(['option','fixed']));
					break;
				case 'advanced':
					this.toggle(['option','advanced']);
					this.checkRequire();
					break;
				case 'debug':
					this.toggle(['option','debug']);
					this.checkRequire();
					break;
			}
		}
	}
};

/** @this {Worker} */
Config.makeImage = function(name, options) {
	options = isObject(options) ? options : isString(options) ? {title:options} : {};
	return '<span' + (options.id ? ' id="' + options.id + '"' : '') + (options.title ? ' title="' + options.title + '"' : '') + ' style="margin-bottom:-4px;' + (options.style ? options.style : '') + '"' + ' class="ui-icon golem-icon golem-icon-' + name + (options.className ? ' ' + options.className : '') + '"></span>';
};

/** @this {Worker} */
Config.addButton = function(options) {
	if (options.advanced >= 0 && !Config.get(['option','advanced'],false)) {
		options.hide = true;
	}
	var html = $('<img class="golem-theme-button golem-button' + (options.active ? '-active' : '') + (options.advanced ? ' golem-advanced' : '') + (options.className ? ' '+options.className : '') + '" ' + (options.id ? 'id="'+options.id+'" ' : '') + (options.title ? 'title="'+options.title+'" ' : '') + (options.hide ? 'style="display:none;" ' : '') + 'src="' + getImage(options.image) + '">');
	if (options.prepend) {
		$('#golem_buttons').prepend(html);
	} else if (options.after) {
		$('#'+options.after).after(html);
	} else {
		$('#golem_buttons').append(html);
	}
	if (options.click) {
		html.click(options.click);
	}
};

/** @this {Worker} */
Config.makeTooltip = function(title, content) {
	var el = $('<div class="ui-widget ui-widget-shadow ui-helper-fixed" style="left:100px;top:100px;z-index:999;">' + // High z-index due to Facebook search bar
		'<h3 class="ui-widget-header" style="padding:2px;cursor:move;">' + title +
			'<span class="ui-icon ui-icon-close" style="float:right;cursor:pointer;"></span>' +
		'</h3>' +
		'<div class="ui-widget-content" style="padding:4px;"><div></div></div>' +
	'</div>')
	.draggable({
		handle:'> h3',
		containment:'window',
		stack:'.tooltips'
	})
//	.resizable({ // Doesn't resize the widget-content properly
//		autoHide: true,
//		handles: 'se',
//		minHeight: 100,
//		minWidth: 100
//	})
	.appendTo('#golem');
	$('.ui-widget-header span', el).click(function(){el.remove();});
	$('.ui-widget-content > div', el).append(content);
	el.show();
};

/** @this {Worker} */
Config.makeWindow = function() {  // Make use of the Facebook CSS for width etc - UIStandardFrame_SidebarAds
	var i, j, k, tmp, stop = false;
	$('#golem').prepend(tmp = $('<div id="golem_config_frame" class="ui-widget ui-helper-hidden' + (this.option.fixed?' ui-helper-fixed':'') + '" style="width:' + $('#golem').width() + 'px;">' +
		'<h3 class="ui-widget-header">' +
			'GameGolem ' + version + (!isRelease ? '.' + revision : '') +
		'</h3>' +
		'<div class="ui-widget-content" style="margin-top:-1px;padding:0 4px 4px 4px;">' +
			'<div id="golem_info" style="margin:0 -4px;">' +
				// Extra info goes in here
			'</div>' +
			'<div id="golem_buttons" style="padding-top:4px;">' +
				// All buttons go in here
			'</div>' +
			'<div id="golem_config" style="display:none;padding-top:4px;">' +
				// All config panels go in here
			'</div>' +
		'</div>' +
	'</div>'));
	this.addButton({
		id:'golem_options',
		image:'options',
		title:'Show Options',
		active:this.option.display,
		className:this.option.display ? 'green' : '',
		click:function(){
			$(this).toggleClass('golem-button golem-button-active green');
			Config.toggle(['option','display'], true);
			$('#golem_config').toggle('blind'); //Config.option.fixed?null:
		}
	});

	// Propagate all before and after settings
	for (i in Workers) {
		if (Workers[i].settings.before) {
			for (j=0; j<Workers[i].settings.before.length; j++) {
				k = Worker.find(Workers[i].settings.before[j]);
				if (k) {
					k.settings.after = k.settings.after || [];
					k.settings.after.push(Workers[i].name);
					k.settings.after = k.settings.after.unique();
//					log(LOG_WARN, 'Pushing '+k.name+' after '+Workers[i].name+' = '+k.settings.after);
				}
			}
		}
		if (Workers[i].settings.after) {
			for (j=0; j<Workers[i].settings.after.length; j++) {
				k = Worker.find(Workers[i].settings.after[j]);
				if (k) {
					k.settings.before = k.settings.before || [];
					k.settings.before.push(Workers[i].name);
					k.settings.before = k.settings.before.unique();
//					log(LOG_WARN, 'Pushing '+k.name+' before '+Workers[i].name+' = '+k.settings.before);
				}
			}
		}
	}
	for (i in Workers) {
		this.makePanel(Workers[i]);
	}
	$('#golem_config')
		.sortable({
			axis: 'y',
			containment: 'parent',
			distance: 15,
			handle: '> h3',
			items: '> div:not(.golem-unsortable)',
			tolerance: 'pointer',
			start: function(event) {
				$('#golem_config').data('stop', true);
			},
			stop: function(event) {
				var i, el, order = [];
				el = $('#golem_config > div');
				for (i=0; i<el.length; i++) {
					order.push($(el[i]).attr('name'));
				}
				Queue.set(['option','queue'], order.unique());
			}
		});
	$( "#golem_config > div > h3 > a" ).click(function(event) {
		if ($('#golem_config').data('stop')) {
			event.stopImmediatePropagation();
			event.preventDefault();
			$('#golem_config').data('stop', false);
		}
	});
	this._update('show');
};

/** @this {Worker} */
Config.makePanel = function(worker, args) {
	if (!isWorker(worker)) {
		if (Worker.stack.length <= 1) {
			return;
		}
		args = worker;
		worker = Worker.get(Worker.stack[0]);
	}
	if (!args) {
		if (!worker.display) {
			return;
		}
		args = worker.display;
	}
	if (!$('#'+worker.id).length) {
		var name = worker.name, tmp, display = (worker.settings.advanced && !this.option.advanced) || (worker.settings.debug && !this.option.debug) || (worker.settings.exploit && !this.option.exploit), sleep = worker.get(['option','_sleep'], false) ? '' : 'ui-helper-hidden';
		$('#golem_config').append(tmp = $(
			'<div id="' + worker.id + '" name="' + name + '" class="' + (worker.settings.unsortable ? 'golem-unsortable' : '') + '"' + (display ? ' style="display:none;"' : '') + '>' +
				'<h3>' +
					'<a href="#">' +
						(worker.settings.unsortable ? '<span class="ui-icon ui-icon-locked" style="float:left;margin-top:-2px;margin-left:-4px;"></span>' : '') +
						name +
						this.makeImage('zzz', {title:name + ' sleeping...', id:'golem_sleep_' + name, className:sleep}) +
					'</a>' +
				'</h3>' +
				'<div class="' + (worker.settings.advanced ? 'red' : '') + (worker.settings.debug ? ' blue' : '') + (worker.settings.exploit ? ' purple' : '') + '" style="font-size:smaller;"></div>' +
			'</div>'
		));
		name = worker.name;
		$('#'+worker.id).accordion({
			collapsible: true,
			autoHeight: false,
			clearStyle: true,
			animated: 'blind',
			header: '> h3',
			active: worker.get(['option','_config','_show'], false) && 0,
			change: function(event, ui){
				Workers[name].set(['option','_config','_show'], ui.newHeader.length ? true : undefined, null, true); // Only set when *showing* panel
			}
		});
		this._watch(worker, 'option._config');
		this._watch(worker, 'option._sleep');
	} else {
		$('#'+worker.id+' > div').empty();
	}
	this.addOption(worker, args);
};

/** @this {Worker} */
Config.makeID = function(worker, id) {
	return PREFIX + worker.name.toLowerCase().replace(/[^0-9a-z]/g,'-') + '_' + id;
};

/** @this {Worker} */
Config.clearPanel = function(selector) {
	this._init(); // Make sure we're properly loaded first!
	if (isWorker(selector)) {
		selector = '#'+selector.id+' > div';
	} else if (typeof selector === 'undefined' || !selector) {
		if (Worker.stack.length <= 1) {
			return;
		}
		selector = '#'+Workers[Worker.stack[0]].id+' > div';
	}
	$(selector).empty();
};

/** @this {Worker} */
Config.addOption = function(selector, args) {
	this._init(); // Make sure we're properly loaded first!
	var worker;
	if (isWorker(selector)) {
		worker = selector;
		selector = '#'+selector.id+' > div';
	} else if (typeof args === 'undefined' || !args) {
		if (Worker.stack.length <= 1) {
			return;
		}
		worker = Workers[Worker.stack[0]];
		args = selector;
		selector = '#'+worker.id+' > div';
	}
	$(selector).append(this.makeOptions(worker, args));
};

/** @this {Worker} */
Config.makeOptions = function(worker, args) {
	this._init(); // Make sure we're properly loaded first!
	if (isArray(args)) {
		var i, $output = $('<div></div>');
		for (i=0; i<args.length; i++) {
			$output = $output.append(this.makeOptions(worker, args[i]));
		}
		return $output;
	} else if (isObject(args)) {
		return this.makeOption(worker, args);
	} else if (isString(args)) {
		return this.makeOption(worker, {title:args});
	} else if (isFunction(args)) {
		try {
			return this.makeOptions(worker, args.call(worker));
		} catch(e) {
			log(LOG_WARN, e.name + ' in Config.makeOptions(' + worker.name + '.display()): ' + e.message);
		}
	} else {
		log(LOG_ERROR, worker.name+' is trying to add an unknown type of option: '+(typeof args));
	}
	return $([]);
};

/** @this {Worker} */
Config.makeOption = function(worker, args) {
	var i, j, o, r, v, step, $option, tmp, name, txt = [], list = [];
	o = $.extend({}, {
		before: '',
		after: '',
		suffix: '',
		className: '',
		between: 'to',
		real_id: ''
	}, args);
	if (o.id) {
		if (!isArray(o.id)) {
			o.id = o.id.split('.');
		}
		if (o.id.length > 0 && Workers[o.id[0]]) {
			worker = Workers[o.id.shift()];
		}
		if (isUndefined(worker._datatypes[o.id[0]])) {
			o.id.unshift('option');
		}
		o.path = o.id;
		o.id = o.id.slice(1).join('.');
		this._watch(worker, o.path);
		o.real_id = ' id="' + this.makeID(worker, o.id) + '"';
		o.value = worker.get(o.path, null);
	}
	if (o.group) {
		if (o.title) {
			tmp = o.title.toLowerCase().replace(/[^a-z0-9]/g,'');
			name = worker.name;
			$option = $('<div class="' + (worker.settings.advanced ? 'red' : '') + (worker.settings.debug ? ' blue' : '') + (worker.settings.exploit ? ' purple' : '') + '" id="' + worker.id + '_' + tmp + '"><h3><a href="#">' + o.title + '</a></h3></div>').append(this.makeOptions(worker,o.group));
			$option.accordion({
				collapsible: true,
				autoHeight: false,
				clearStyle: true,
				animated: 'blind',
				active: worker.get(['option','_config',tmp], false) || 0,
				change: function(event, ui){
					Workers[name].set(['option','_config',tmp], ui.newHeader.length ? undefined : true, null, true); // Only set when *hiding* panel
				}
			});
		} else {
			$option = this.makeOptions(worker,o.group);
		}
	} else {
		o.alt = (o.alt ? ' alt="'+o.alt+'"' : '');
		if (o.hr) {
			txt.push('<br><hr style="clear:both;margin:0;">');
		}
		if (o.title) {
			txt.push('<h4 class="golem-group-title">' + o.title.replace(' ','&nbsp;') + '</h4>');
		}
		if (o.label && !o.button) {
			txt.push('<span style="float:left;margin-top:2px;">'+o.label.replace(' ','&nbsp;')+'</span>');
			if (o.text || o.checkbox || o.select || o.number) {
				txt.push('<span style="float:right;">');
			} else if (o.multiple) {
				txt.push('<br>');
			}
		}
		if (o.before) {
			txt.push(o.before+' ');
		}
		// our different types of input elements
		if (o.info) { // only useful for externally changed
			if (o.id) {
				txt.push('<span style="float:right"' + o.real_id + '>' + (o.value || o.info).toString().html_escape() + '</span>');
			} else {
				txt.push(o.info);
			}
		} else if (o.text) {
			txt.push('<input type="text"' + o.real_id + (o.label || o.before || o.after ? '' : ' style="width:100%;"') + ' size="' + (o.cols || o.size || 18) + '" value="' + (o.value || isNumber(o.value) ? o.value : '').toString().html_escape().quote_escape() + '">');
		} else if (o.number) {
			txt.push('<input type="number"' + o.real_id + (o.label || o.before || o.after ? '' : ' style="width:100%;"') + ' size="' + (o.cols || o.size || 6) + '"' + (o.step ? ' step="'+o.step+'"' : '') + (isNumber(o.min) ? ' min="'+o.min+'"' : '') + (isNumber(o.max) ? ' max="'+o.max+'"' : '') + ' value="' + (isNumber(o.value) ? o.value : (o.min || 0)) + '">');
		} else if (o.textarea) {
			txt.push('<textarea' + o.real_id + ' cols="' + (o.cols || 20) + '" rows="' + (o.rows || 5) + '"' + (o.id ? '' : ' disabled') + ' style="float:right;margin-left:0;margin-right:0;' + (o.resize ? 'resize:'+o.resize+';' : '') + '" placeholder="Type here...">');
			txt.push((o.value || '').toString().html_escape());
			txt.push('</textarea>');
		} else if (o.checkbox) {
			txt.push('<input type="checkbox"' + o.real_id + (o.value ? ' checked' : '') + '>');
		} else if (o.button) {
			txt.push('<input type="button"' + o.real_id + ' value="' + o.label + '">');
		} else if (o.select) {
			v = isFunction(o.select) ? o.select.call(worker, o.id) : o.select;
			if (isString(v)) {
				o.className = ' class="golem_'+v+'"';
				i = this.get(['data',v]);
				if (isObject(i) || isArray(i) || isNumber(i)) {
					this._watch(this, 'data.'+v); // set up a watch on the data
					v = i;
				}
			}
			if (isObject(v)) {
				for (i in v) {
					/*jslint eqeqeq:false*/
					list.push('<option value="'+i+'"' + (o.value==i ? ' selected' : '') + '>' + v[i] + (o.suffix ? ' '+o.suffix : '') + '</option>');
					/*jslint eqeqeq:true*/
				}
			} else if (isArray(v)) {
				for (i = 0; i < v.length; i++) {
					/*jslint eqeqeq:false*/
					list.push('<option value="'+v[i]+'"' + (o.value==v[i] ? ' selected' : '') + '>' + v[i] + (o.suffix ? ' '+o.suffix : '') + '</option>');
					/*jslint eqeqeq:true*/
				}
			} else if (isNumber(v)) {
				step = Divisor(v);
				for (i = 0; i <= v; i += step) {
					/*jslint eqeqeq:false*/
					list.push('<option value="'+i+'"' + (o.value==i ? ' selected' : '') + '>' + i + (o.suffix ? ' '+o.suffix : '')+ '</option>');
					/*jslint eqeqeq:true*/
				}
			}
			txt.push('<select' + o.real_id + o.className + o.alt + '>' + list.join('') + '</select>');
		} else if (o.multiple) {
			v = isFunction(o.multiple) ? o.multiple.call(worker, o.id) : o.multiple;
			if (isString(v)) {
				o.className = ' class="golem_'+v+'"';
				i = this.get(['data',v]);
				if (isObject(i) || isArray(i) || isNumber(i)) {
					this._watch(this, 'data.'+v); // set up a watch on the data
					v = i;
				}
			}

			// prepare the "selected" set
			if (isArray(o.value)) {
				for (i = 0; i < o.value.length; i++) {
					list.push('<option>'+o.value[i].toString().html_escape()+'</option>');
				}
			} else if (isObject(o.value)) {
				for (i in o.value) {
					list.push('<option>'+o.value[i].toString().html_escape()+'</option>');
				}
			}
			txt.push('<select style="width:100%;clear:both;" class="golem_multiple" multiple' + o.real_id + '>' + list.join('') + '</select><br>');

			// prepare the selection list
			if (isString(v)) {
				txt.push('<input class="golem_select" type="text" size="' + (o.cols || o.size || 18) + '">');
			} else {
				list = [];
				if (isObject(v)) {
					for (i in v) {
						list.push('<option value="'+i+'">' + v[i] + (o.suffix ? ' '+o.suffix : '') + '</option>');
						}
				} else if (isArray(v)) {
					for (i = 0; i < v.length; i++) {
						list.push('<option value="'+v[i]+'">' + v[i] + (o.suffix ? ' '+o.suffix : '') + '</option>');
					}
				} else if (isNumber(v)) {
					step = Divisor(v);
					for (i = 0; i <= v; i += step) {
						list.push('<option value="'+i+'">' + i + (o.suffix ? ' '+o.suffix : '') + '</option>');
					}
				}
				txt.push('<select class="golem_select">' + list.join('') + '</select>');
			}
			txt.push('<input type="button" class="golem_addselect" value="Add" />');
			txt.push('<input type="button" class="golem_delselect" value="Del" />');
		}
		if (o.after) {
			txt.push(' '+o.after);
		}
		if (o.label && (o.text || o.checkbox || o.select || o.multiple)) {
			txt.push('</span>');
		}
		$option = $('<div class="ui-helper-clearfix">' + txt.join('') + '</div>');
		$('textarea', $option).autoSize();
		if (o.require || o.advanced || o.debug || o.exploit) {
			try {
				r = {depth:0};
				r.require = {};
				if (o.advanced) {
					r.require.advanced = true;
					$option.addClass('red');
				}
				if (o.debug) {
					r.require.debug = true;
					$option.addClass('blue');
				}
				if (o.exploit) {
					r.require.exploit = true;
					$option.addClass('purple').css({border:'1px solid red'});
				}
				if (o.require) {
					r.require.x = new Script(o.require, {'default':worker.get('option')});
				}
				this.temp.require.push(r.require);
				$option.attr('id', 'golem_require_'+(this.temp.require.length-1)).css('display', this.checkRequire(this.temp.require.length - 1) ? '' : 'none');
			} catch(e) {
				log(LOG_ERROR, e.name + ' in createRequire(' + o.require + '): ' + e.message);
			}
		}
	}
	if (o.help) {
		$option.attr('title', o.help);
	}
	return $option;
};

/** @this {Worker} */
Config.checkRequire = function(id) {
	var i, show = true, require;
	if (!isNumber(id) || !(require = this.temp.require[id])) {
		for (i=0; i<this.temp.require.length; i++) {
			arguments.callee.call(this, i);
		}
		return;
	}
	if ((require.advanced && !Config.option.advanced)
	  || (require.debug && !Config.option.debug)
	  || (require.exploit && !Config.option.exploit)
	  || (require.x && !require.x.run())
	) {
		//log(LOG_DEBUG, '# '+id+': ' + JSON.shallow(require,3));
		show = false;
	}
	if (require.show !== show) {
		require.show = show;
		$('#golem_require_'+id).css('display', show ? '' : 'none');
	}
	return show;
};

