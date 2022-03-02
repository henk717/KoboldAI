//=================================================================//
//  VARIABLES
//=================================================================//

// Socket IO Object
var socket;

// UI references for jQuery
var connect_status;
var button_newgame;
var button_rndgame;
var button_save;
var button_saveas;
var button_savetofile;
var button_load;
var button_import;
var button_importwi;
var button_impaidg;
var button_settings;
var button_format;
var button_softprompt;
var button_userscripts;
var button_mode;
var button_mode_label;
var button_send;
var button_actmem;
var button_actback;
var button_actfwd;
var button_actretry;
var button_actwi;
var game_text;
var input_text;
var message_text;
var chat_name;
var settings_menu;
var format_menu;
var wi_menu;
var anote_menu;
var anote_input;
var anote_labelcur;
var anote_slider;
var debug_area;
var popup;
var popup_title;
var popup_content;
var popup_accept;
var popup_close;
var aidgpopup;
var aidgpromptnum;
var aidg_accept;
var aidg_close;
var saveaspopup;
var saveasinput;
var savepins;
var topic;
var saveas_accept;
var saveas_close;
var loadpopup;
var	loadcontent;
var	load_accept;
var	load_close;
var sppopup;
var	spcontent;
var	sp_accept;
var	sp_close;
var uspopup;
var	uscontent;
var	us_accept;
var	us_close;
var nspopup;
var ns_accept;
var ns_close;
var rspopup;
var rs_accept;
var rs_close;
var seqselmenu;
var seqselcontents;

var storyname = null;
var memorymode = false;
var memorytext = "";
var gamestarted = false;
var wiscroll = 0;
var editmode = false;
var connected = false;
var newly_loaded = true;
var modified_chunks = new Set();
var empty_chunks = new Set();
var gametext_bound = false;
var saved_prompt = "...";
var wifolders_d = {};
var wifolders_l = [];
var override_focusout = false;
var sman_allow_delete = false;
var sman_allow_rename = false;
var allowsp = false;
var remote = false;
var gamestate = "";
var gamesaved = true;
var modelname = null;

// This is true iff [we're in macOS and the browser is Safari] or [we're in iOS]
var using_webkit_patch = true;

// Key states
var shift_down   = false;
var do_clear_ent = false;

// Display vars
var allowtoggle = false;
var formatcount = 0;
var allowedit   = true;  // Whether clicking on chunks will edit them

// Adventure
var action_mode = 0;  // 0: story, 1: action
var adventure = false;

// Chatmode
var chatmode = false;

//=================================================================//
//  METHODS
//=================================================================//

function addSetting(ob) {	
	// Add setting block to Settings Menu
	if(ob.uitype == "slider"){
		settings_menu.append("<div class=\"settingitem\">\
		<div class=\"settinglabel\">\
			<div class=\"justifyleft\">\
				"+ob.label+" <span class=\"helpicon\">?<span class=\"helptext\">"+ob.tooltip+"</span></span>\
			</div>\
			<div class=\"justifyright\" id=\""+ob.id+"cur\">\
				"+ob.default+"\
			</div>\
		</div>\
		<div>\
			<input type=\"range\" class=\"form-range airange\" min=\""+ob.min+"\" max=\""+ob.max+"\" step=\""+ob.step+"\" id=\""+ob.id+"\">\
		</div>\
		<div class=\"settingminmax\">\
			<div class=\"justifyleft\">\
				"+ob.min+"\
			</div>\
			<div class=\"justifyright\">\
				"+ob.max+"\
			</div>\
		</div>\
		</div>");
		// Set references to HTML objects
		var refin = $("#"+ob.id);
		var reflb = $("#"+ob.id+"cur");
		window["setting_"+ob.id] = refin;  // Is this still needed?
		window["label_"+ob.id]   = reflb;  // Is this still needed?
		// Add event function to input
		refin.on("input", function () {
			socket.send({'cmd': $(this).attr('id'), 'data': $(this).val()});
		});
	} else if(ob.uitype == "toggle"){
		settings_menu.append("<div class=\"settingitem\">\
			<input type=\"checkbox\" data-toggle=\"toggle\" data-onstyle=\"success\" id=\""+ob.id+"\">\
			<span class=\"formatlabel\">"+ob.label+" </span>\
			<span class=\"helpicon\">?<span class=\"helptext\">"+ob.tooltip+"</span></span>\
		</div>");
		// Tell Bootstrap-Toggle to render the new checkbox
		$("input[type=checkbox]").bootstrapToggle();
		$("#"+ob.id).on("change", function () {
			if(allowtoggle) {
				socket.send({'cmd': $(this).attr('id'), 'data': $(this).prop('checked')});
			}
			if(ob.id == "setadventure"){
				setadventure($(this).prop('checked'));
			}
		});
	}
}

function refreshTitle() {
	var title = gamesaved ? "" : "\u2731 ";
	if(storyname !== null) {
		title += storyname + " \u2014 ";
	}
	title += "KoboldAI Client";
	if(modelname !== null) {
		title += " (" + modelname + ")";
	}
	document.title = title;
}

function setGameSaved(state) {
	gamesaved = !!state;
	refreshTitle();
}

function addFormat(ob) {
	// Check if we need to make a new column for this button
	if(formatcount == 0) {
		format_menu.append("<div class=\"formatcolumn\"></div>");
	}
	// Get reference to the last child column
	var ref = $("#formatmenu > div").last();
	// Add format block to Format Menu
	ref.append("<div class=\"formatrow\">\
		<input type=\"checkbox\" data-toggle=\"toggle\" data-onstyle=\"success\" id=\""+ob.id+"\">\
		<span class=\"formatlabel\">"+ob.label+" </span>\
		<span class=\"helpicon\">?<span class=\"helptext\">"+ob.tooltip+"</span></span>\
	</div>");
	// Tell Bootstrap-Toggle to render the new checkbox
	$("input[type=checkbox]").bootstrapToggle();
	// Add event to input
	$("#"+ob.id).on("change", function () {
		if(allowtoggle) {
			socket.send({'cmd': $(this).attr('id'), 'data': $(this).prop('checked')});
		}
	});
	// Increment display variable
	formatcount++;
	if(formatcount == 2) {
		formatcount = 0;
	}
}

function addImportLine(ob) {
	popup_content.append("<div class=\"popuplistitem\" id=\"import"+ob.num+"\">\
		<div>"+ob.title+"</div>\
		<div>"+ob.acts+"</div>\
		<div>"+ob.descr+"</div>\
	</div>");
	$("#import"+ob.num).on("click", function () {
		socket.send({'cmd': 'importselect', 'data': $(this).attr('id')});
		highlightImportLine($(this));
	});
}

function adjustWiCommentHeight(element) {
	element.style.height = "0px";
	element.style.height = element.scrollHeight + "px";
	element.parentNode.parentNode.style.height = element.scrollHeight + 90 + "px";
}

function adjustWiFolderNameHeight(element) {
	element.style.height = "0px";
	element.style.height = element.scrollHeight + "px";
	element.parentNode.parentNode.parentNode.style.height = element.scrollHeight + 19 + "px";
}

function addWiLine(ob) {
	var current_wifolder_element = ob.folder === null ? $(".wisortable-body:not([folder-uid])").last() : $(".wisortable-body[folder-uid="+ob.folder+"]");
	if(ob.init) {
		if(ob.selective){
			current_wifolder_element.append("<div class=\"wilistitem wilistitem-selective "+(ob.constant ? "wilistitem-constant" : "")+"\" num=\""+ob.num+"\" uid=\""+ob.uid+"\" id=\"wilistitem"+ob.num+"\">\
				<div class=\"wicomment\">\
					<textarea class=\"form-control\" placeholder=\"Comment\" id=\"wicomment"+ob.num+"\">"+ob.comment+"</textarea>\
				</div>\
				<div class=\"wihandle\" id=\"wihandle"+ob.num+"\">\
					<div class=\"wicentered\">\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
					</div>\
				</div>\
				<div class=\"wiremove\">\
					<button type=\"button\" class=\"btn btn-primary heightfull\" id=\"btn_wi"+ob.num+"\">X</button>\
					<button type=\"button\" class=\"btn btn-success heighthalf hidden\" id=\"btn_widel"+ob.num+"\">✓</button>\
					<button type=\"button\" class=\"btn btn-danger heighthalf hidden\" id=\"btn_wican"+ob.num+"\">⮌</button>\
				</div>\
				<div class=\"icon-container wikey\">\
					<input class=\"form-control wiheightfull hidden\" type=\"text\" placeholder=\"Key(s)\" id=\"wikey"+ob.num+"\">\
					<input class=\"form-control wiheighthalf\" type=\"text\" placeholder=\"Primary Key(s)\" id=\"wikeyprimary"+ob.num+"\">\
					<input class=\"form-control wiheighthalf\" type=\"text\" placeholder=\"Secondary Key(s)\" id=\"wikeysecondary"+ob.num+"\">\
					<span class=\"selective-key-icon "+(ob.selective ? "selective-key-icon-enabled" : "")+" oi oi-layers\" id=\"selective-key-"+ob.num+"\" title=\"Toggle Selective Key mode (if enabled, this world info entry will be included in memory only if at least one PRIMARY KEY and at least one SECONDARY KEY are both present in the story)\" aria-hidden=\"true\"></span>\
					<span class=\"constant-key-icon "+(ob.constant ? "constant-key-icon-enabled" : "")+" oi oi-pin\" id=\"constant-key-"+ob.num+"\" title=\"Toggle Constant Key mode (if enabled, this world info entry will always be included in memory)\" aria-hidden=\"true\"></span>\
				</div>\
				<div class=\"wientry\">\
					<textarea class=\"layer-bottom form-control\" id=\"wientry"+ob.num+"\" placeholder=\"What To Remember\">"+ob.content+"</textarea>\
				</div>\
			</div>");
		} else {
			current_wifolder_element.append("<div class=\"wilistitem "+(ob.constant ? "wilistitem-constant" : "")+"\" num=\""+ob.num+"\" uid=\""+ob.uid+"\" id=\"wilistitem"+ob.num+"\">\
				<div class=\"wicomment\">\
					<textarea class=\"form-control\" placeholder=\"Comment\" id=\"wicomment"+ob.num+"\">"+ob.comment+"</textarea>\
				</div>\
				<div class=\"wihandle\" id=\"wihandle"+ob.num+"\">\
					<div class=\"wicentered\">\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
					</div>\
				</div>\
				<div class=\"wiremove\">\
					<button type=\"button\" class=\"btn btn-primary heightfull\" id=\"btn_wi"+ob.num+"\">X</button>\
					<button type=\"button\" class=\"btn btn-success heighthalf hidden\" id=\"btn_widel"+ob.num+"\">✓</button>\
					<button type=\"button\" class=\"btn btn-danger heighthalf hidden\" id=\"btn_wican"+ob.num+"\">⮌</button>\
				</div>\
				<div class=\"icon-container wikey\">\
					<input class=\"form-control wiheightfull\" type=\"text\" placeholder=\"Key(s)\" id=\"wikey"+ob.num+"\">\
					<input class=\"form-control wiheighthalf hidden\" type=\"text\" placeholder=\"Primary Key(s)\" id=\"wikeyprimary"+ob.num+"\">\
					<input class=\"form-control wiheighthalf hidden\" type=\"text\" placeholder=\"Secondary Key(s)\" id=\"wikeysecondary"+ob.num+"\">\
					<span class=\"selective-key-icon "+(ob.selective ? "selective-key-icon-enabled" : "")+" oi oi-layers\" id=\"selective-key-"+ob.num+"\" title=\"Toggle Selective Key mode (if enabled, this world info entry will be included in memory only if at least one PRIMARY KEY and at least one SECONDARY KEY are both present in the story)\" aria-hidden=\"true\"></span>\
					<span class=\"constant-key-icon "+(ob.constant ? "constant-key-icon-enabled" : "")+" oi oi-pin\" id=\"constant-key-"+ob.num+"\" title=\"Toggle Constant Key mode (if enabled, this world info entry will always be included in memory)\" aria-hidden=\"true\"></span>\
				</div>\
				<div class=\"wientry\">\
					<textarea class=\"form-control\" id=\"wientry"+ob.num+"\" placeholder=\"What To Remember\">"+ob.content+"</textarea>\
				</div>\
			</div>");
		}
		adjustWiCommentHeight($("#wicomment"+ob.num)[0]);
		// Send key value to text input
		$("#wikey"+ob.num).val(ob.key);
		$("#wikeyprimary"+ob.num).val(ob.key);
		$("#wikeysecondary"+ob.num).val(ob.keysecondary);
		// Assign delete event to button
		$("#btn_wi"+ob.num).on("click", function () {
			showWiDeleteConfirm(ob.num);
		});
	} else {
		// Show WI line item with form fields hidden (uninitialized)
		current_wifolder_element.append("<div class=\"wilistitem wilistitem-uninitialized wisortable-excluded\" num=\""+ob.num+"\" uid=\""+ob.uid+"\" id=\"wilistitem"+ob.num+"\">\
			<div class=\"wicomment\">\
				<textarea class=\"form-control hidden\" placeholder=\"Comment\" id=\"wicomment"+ob.num+"\">"+ob.comment+"</textarea>\
			</div>\
			<div class=\"wihandle-inactive hidden\" id=\"wihandle"+ob.num+"\">\
				<div class=\"wicentered\">\
					<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
					<br/>\
					<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
					<br/>\
					<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
					<br/>\
					<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
					<br/>\
					<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
					<br/>\
					<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
					<br/>\
					<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
				</div>\
			</div>\
			<div class=\"wiremove\">\
				<button type=\"button\" class=\"btn btn-primary heightfull\" id=\"btn_wi"+ob.num+"\">+</button>\
				<button type=\"button\" class=\"btn btn-success heighthalf hidden\" id=\"btn_widel"+ob.num+"\">✓</button>\
				<button type=\"button\" class=\"btn btn-danger heighthalf hidden\" id=\"btn_wican"+ob.num+"\">X</button>\
			</div>\
			<div class=\"icon-container wikey\">\
				<input class=\"form-control wiheightfull hidden\" type=\"text\" placeholder=\"Key(s)\" id=\"wikey"+ob.num+"\">\
				<input class=\"form-control wiheighthalf hidden\" type=\"text\" placeholder=\"Primary Key(s)\" id=\"wikeyprimary"+ob.num+"\">\
				<input class=\"form-control wiheighthalf hidden\" type=\"text\" placeholder=\"Secondary Key(s)\" id=\"wikeysecondary"+ob.num+"\">\
				<span class=\"selective-key-icon oi oi-layers hidden\" id=\"selective-key-"+ob.num+"\" title=\"Toggle Selective Key mode (if enabled, this world info entry will be included in memory only if at least one PRIMARY KEY and at least one SECONDARY KEY are both present in the story)\" aria-hidden=\"true\"></span>\
				<span class=\"constant-key-icon oi oi-pin hidden\" id=\"constant-key-"+ob.num+"\" title=\"Toggle Constant Key mode (if enabled, this world info entry will always be included in memory)\" aria-hidden=\"true\"></span>\
			</div>\
			<div class=\"wientry\">\
				<textarea class=\"layer-bottom form-control hidden\" id=\"wientry"+ob.num+"\" placeholder=\"What To Remember\">"+ob.content+"</textarea>\
			</div>\
		</div>");
		// Assign function to expand WI item to button
		$("#btn_wi"+ob.num).on("click", function () {
			var folder = $("#wilistitem"+ob.num).parent().attr("folder-uid");
			if(folder === undefined) {
				folder = null;
			} else {
				folder = parseInt(folder);
			}
			socket.send({'cmd': 'wiexpand', 'data': ob.num});
			socket.send({'cmd': 'wiinit', 'folder': folder, 'data': ob.num});
		});
	}
	// Assign actions to other elements
	wientry_onfocus = function () {
		$("#selective-key-"+ob.num).addClass("selective-key-icon-clickthrough");
		$("#constant-key-"+ob.num).addClass("constant-key-icon-clickthrough");
	}
	wientry_onfocusout = function () {
		$("#selective-key-"+ob.num).removeClass("selective-key-icon-clickthrough");
		$("#constant-key-"+ob.num).removeClass("constant-key-icon-clickthrough");
		// Tell server about updated WI fields
		var selective = $("#wilistitem"+ob.num)[0].classList.contains("wilistitem-selective");
		socket.send({'cmd': 'wiupdate', 'num': ob.num, 'data': {
			key: selective ? $("#wikeyprimary"+ob.num).val() : $("#wikey"+ob.num).val(),
			keysecondary: $("#wikeysecondary"+ob.num).val(),
			content: $("#wientry"+ob.num).val(),
			comment: $("#wicomment"+ob.num).val(),
		}});
	}
	$("#wikey"+ob.num).on("focus", wientry_onfocus);
	$("#wikeyprimary"+ob.num).on("focus", wientry_onfocus);
	$("#wikeysecondary"+ob.num).on("focus", wientry_onfocus);
	$("#wientry"+ob.num).on("focus", wientry_onfocus);
	$("#wicomment"+ob.num).on("focus", wientry_onfocus);
	$("#wikey"+ob.num).on("focusout", wientry_onfocusout);
	$("#wikeyprimary"+ob.num).on("focusout", wientry_onfocusout);
	$("#wikeysecondary"+ob.num).on("focusout", wientry_onfocusout);
	$("#wientry"+ob.num).on("focusout", wientry_onfocusout);
	$("#wicomment"+ob.num).on("focusout", wientry_onfocusout);
	$("#btn_wican"+ob.num).on("click", function () {
		hideWiDeleteConfirm(ob.num);
	});
	$("#btn_widel"+ob.num).on("click", function () {
		socket.send({'cmd': 'widelete', 'data': ob.uid});
	});
	$("#selective-key-"+ob.num).on("click", function () {
		var element = $("#selective-key-"+ob.num);
		if(element.hasClass("selective-key-icon-enabled")) {
			socket.send({'cmd': 'wiseloff', 'data': ob.num});
		} else {
			socket.send({'cmd': 'wiselon', 'data': ob.num});
		}
	});
	$("#constant-key-"+ob.num).on("click", function () {
		var element = $("#constant-key-"+ob.num);
		if(element.hasClass("constant-key-icon-enabled")) {
			socket.send({'cmd': 'wiconstantoff', 'data': ob.num});
		} else {
			socket.send({'cmd': 'wiconstanton', 'data': ob.num});
		}
	});
	$("#wihandle"+ob.num).off().on("mousedown", function () {
		wientry_onfocusout()
		$(".wisortable-container").addClass("wisortable-excluded");
		// Prevent WI entries with extremely long comments from filling the screen and preventing scrolling
		$(this).parent().css("max-height", "200px").find(".wicomment").find(".form-control").css("max-height", "110px");
	}).on("mouseup", function () {
		$(".wisortable-excluded-dynamic").removeClass("wisortable-excluded-dynamic");
		$(this).parent().css("max-height", "").find(".wicomment").find(".form-control").css("max-height", "");
	});
}

function addWiFolder(uid, ob) {
	if(uid !== null) {
		var uninitialized = $("#wilistfoldercontainer"+null);
		var html = "<div class=\"wisortable-container "+(ob.collapsed ? "" : "folder-expanded")+"\" id=\"wilistfoldercontainer"+uid+"\" folder-uid=\""+uid+"\">\
			<div class=\"wilistfolder\" id=\"wilistfolder"+uid+"\">\
				<div class=\"wiremove\">\
					<button type=\"button\" class=\"btn btn-primary heightfull\" id=\"btn_wifolder"+uid+"\">X</button>\
					<button type=\"button\" class=\"btn btn-success heighthalf hidden\" id=\"btn_wifolderdel"+uid+"\">✓</button>\
					<button type=\"button\" class=\"btn btn-danger heighthalf hidden\" id=\"btn_wifoldercan"+uid+"\">⮌</button>\
				</div>\
				<div class=\"wifoldericon\">\
					<div class=\"wicentered\">\
						<span class=\"oi oi-folder folder-expand "+(ob.collapsed ? "" : "folder-expanded")+"\" id=\"btn_wifolderexpand"+uid+"\" aria-hidden=\"true\"></span>\
					</div>\
				</div>\
				<div class=\"wifoldername\">\
					<div class=\"wicentered-vertical\">\
						<textarea class=\"form-control\" placeholder=\"Untitled Folder\" id=\"wifoldername"+uid+"\">"+ob.name+"</textarea>\
					</div>\
				</div>\
				<div class=\"wihandle wifolderhandle\" id=\"wifolderhandle"+uid+"\">\
					<div class=\"wicentered\">\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
					</div>\
				</div>\
			</div>\
			<div class=\"wifoldergutter-container\" id=\"wifoldergutter"+uid+"\">\
				<div class=\"wifoldergutter\"></div>\
			</div>\
			<div class=\"wisortable-body\" folder-uid=\""+uid+"\">\
				<div class=\"wisortable-dummy\"></div>\
			</div>\
		</div>";
		if(uninitialized.length) {
			$(html).insertBefore(uninitialized);
		} else {
			wi_menu.append(html);
		}
		var onfocusout = function () {
			socket.send({'cmd': 'wifolderupdate', 'uid': uid, 'data': {
				name: $("#wifoldername"+uid).val(),
				collapsed: !$("#btn_wifolderexpand"+uid).hasClass("folder-expanded"),
			}});
		};
		$("#wifoldergutter"+uid).on("click", function () {
			$(this).siblings(".wilistfolder")[0].scrollIntoView();
		});
		$("#btn_wifolder"+uid).on("click", function () {
			showWiFolderDeleteConfirm(uid);
		});
		$("#btn_wifolderdel"+uid).on("click", function () {
			socket.send({'cmd': 'wifolderdelete', 'data': uid});
		});
		$("#btn_wifoldercan"+uid).on("click", function () {
			hideWiFolderDeleteConfirm(uid);
		})
		$("#wifoldername"+uid).on("focusout", onfocusout);
		$("#wifolderhandle"+uid).off().on("mousedown", function () {
			onfocusout();
			$(".wilistitem, .wisortable-dummy").addClass("wisortable-excluded-dynamic");
			// Prevent WI folders with extremely long names from filling the screen and preventing scrolling
			$(this).parent().parent().find(".wisortable-body").addClass("hidden");
			$(this).parent().css("max-height", "200px").find(".wifoldername").find(".form-control").css("max-height", "181px");
		}).on("mouseup", function () {
			$(".wisortable-excluded-dynamic").removeClass("wisortable-excluded-dynamic");
			$(this).parent().parent().find(".wisortable-body").removeClass("hidden");
			$(this).parent().css("max-height", "").find(".wifoldername").find(".form-control").css("max-height", "");
		});
		$("#btn_wifolderexpand"+uid).on("click", function () {
			if($(this).hasClass("folder-expanded")) {
				socket.send({'cmd': 'wifoldercollapsecontent', 'data': uid});
			} else {
				socket.send({'cmd': 'wifolderexpandcontent', 'data': uid});
			}
		})
		adjustWiFolderNameHeight($("#wifoldername"+uid)[0]);
		if(ob.collapsed) {
			setTimeout(function() {
				var container = $("#wilistfoldercontainer"+uid);
				hide([container.find(".wifoldergutter-container"), container.find(".wisortable-body")]);
			}, 2);
		}
	} else {
		wi_menu.append("<div class=\"wisortable-container folder-expanded\" id=\"wilistfoldercontainer"+uid+"\">\
			<div class=\"wilistfolder\" id=\"wilistfolder"+uid+"\">\
				<div class=\"wiremove\">\
					<button type=\"button\" class=\"btn btn-primary heightfull\" id=\"btn_wifolder"+uid+"\">+</button>\
					<button type=\"button\" class=\"btn btn-success heighthalf hidden\" id=\"btn_wifolderdel"+uid+"\">✓</button>\
					<button type=\"button\" class=\"btn btn-danger heighthalf hidden\" id=\"btn_wifoldercan"+uid+"\">⮌</button>\
				</div>\
				<div class=\"wifoldericon\">\
					<div class=\"wicentered\">\
						<span class=\"oi oi-folder folder-expand folder-expanded\" id=\"btn_wifolderexpand"+uid+"\" aria-hidden=\"true\"></span>\
					</div>\
				</div>\
				<div class=\"wifoldername\">\
					<div class=\"wicentered-vertical\">\
						<textarea class=\"form-control hidden\" placeholder=\"Untitled Folder\" id=\"wifoldername"+uid+"\"></textarea>\
					</div>\
				</div>\
				<div class=\"wihandle-inactive wifolderhandle hidden\" id=\"wifolderhandle"+uid+"\">\
					<div class=\"wicentered\">\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
						<br/>\
						<span class=\"oi oi-grid-two-up\" aria-hidden=\"true\"></span>\
					</div>\
				</div>\
			</div>\
			<div class=\"wisortable-body\">\
				<div class=\"wisortable-dummy\"></div>\
			</div>\
		</div>");
		$("#btn_wifolder"+uid).on("click", function () {
			expandWiFolderLine(uid);
		});
	}
}

function expandWiLine(num) {
	show([$("#wikey"+num), $("#wientry"+num), $("#wihandle"+num), $("#selective-key-"+num), $("#constant-key-"+num), $("#btn_wiselon"+num), $("#wicomment"+num)]);
	$("#wihandle"+num).removeClass("wihandle-inactive").addClass("wihandle");
	$("#btn_wi"+num).html("X");
	$("#btn_wi"+num).off();
	$("#wilistitem"+num).removeClass("wilistitem-uninitialized").removeClass("wisortable-excluded");
	$("#btn_wi"+num).on("click", function () {
		showWiDeleteConfirm(num);
	});

	adjustWiCommentHeight($("#wicomment"+num)[0]);
}

function expandWiFolderLine(num) {
	socket.send({'cmd': 'wifolderinit', 'data': ''});
}

function showWiDeleteConfirm(num) {
	hide([$("#btn_wi"+num)]);
	show([$("#btn_widel"+num), $("#btn_wican"+num)]);
}

function showWiFolderDeleteConfirm(num) {
	hide([$("#btn_wifolder"+num)]);
	show([$("#btn_wifolderdel"+num), $("#btn_wifoldercan"+num)]);
}

function hideWiDeleteConfirm(num) {
	show([$("#btn_wi"+num)]);
	hide([$("#btn_widel"+num), $("#btn_wican"+num)]);
}

function hideWiFolderDeleteConfirm(num) {
	show([$("#btn_wifolder"+num)]);
	hide([$("#btn_wifolderdel"+num), $("#btn_wifoldercan"+num)]);
}

function collapseWiFolderContent(uid) {
	hide([$("#wifoldergutter"+uid), $(".wisortable-body[folder-uid="+uid+"]")]);
	$("#btn_wifolderexpand"+uid).removeClass("folder-expanded");
	$("#wilistfoldercontainer"+uid).removeClass("folder-expanded");
}

function expandWiFolderContent(uid) {
	show([$("#wifoldergutter"+uid), $(".wisortable-body[folder-uid="+uid+"]")]);
	$("#btn_wifolderexpand"+uid).addClass("folder-expanded");
	$("#wilistfoldercontainer"+uid).addClass("folder-expanded");
}

function enableWiSelective(num) {
	hide([$("#wikey"+num)]);
	$("#wikeyprimary"+num).val($("#wikey"+num).val());
	show([$("#wikeyprimary"+num), $("#wikeysecondary"+num)]);

	var element = $("#selective-key-"+num);
	element.addClass("selective-key-icon-enabled");
	$("#wikey"+num).addClass("wilistitem-selective");
}

function disableWiSelective(num) {
	hide([$("#wikeyprimary"+num), $("#wikeysecondary"+num)]);
	$("#wikey"+num).val($("#wikeyprimary"+num).val());
	show([$("#wikey"+num)]);

	var element = $("#selective-key-"+num);
	element.removeClass("selective-key-icon-enabled");
	$("#wikey"+num).removeClass("wilistitem-selective");
}

function enableWiConstant(num) {
	var element = $("#constant-key-"+num);
	element.addClass("constant-key-icon-enabled");
	$("#wikey"+num).addClass("wilistitem-constant");
}

function disableWiConstant(num) {
	var element = $("#constant-key-"+num);
	element.removeClass("constant-key-icon-enabled");
	$("#wikey"+num).removeClass("wilistitem-constant");
}

function highlightImportLine(ref) {
	$("#popupcontent > div").removeClass("popuplistselected");
	ref.addClass("popuplistselected");
	enableButtons([popup_accept]);
}

function enableButtons(refs) {
	for(i=0; i<refs.length; i++) {
		refs[i].prop("disabled",false);
		refs[i].removeClass("btn-secondary");
		refs[i].addClass("btn-primary");
	}
}

function disableButtons(refs) {
	for(i=0; i<refs.length; i++) {
		refs[i].prop("disabled",true);
		refs[i].removeClass("btn-primary");
		refs[i].addClass("btn-secondary");
	}
}

function enableSendBtn() {
	button_send.removeClass("wait");
	button_send.addClass("btn-primary");
	button_send.html("Submit");
}

function disableSendBtn() {
	button_send.removeClass("btn-primary");
	button_send.addClass("wait");
	button_send.html("");
}

function showMessage(msg) {
	message_text.removeClass();
	message_text.addClass("color_green");
	message_text.html(msg);
}

function errMessage(msg, type="error") {
	message_text.removeClass();
	message_text.addClass(type == "warn" ? "color_orange" : "color_red");
	message_text.html(msg);
}

function hideMessage() {
	message_text.html("");
	message_text.removeClass();
}

function showWaitAnimation() {
	hideWaitAnimation();
	$("#inputrowright").append("<img id=\"waitanim\" src=\"static/thinking.gif\"/>");
}

function hideWaitAnimation() {
	$('#waitanim').remove();
}

function scrollToBottom() {
	setTimeout(function () {
		game_text.stop(true).animate({scrollTop: game_text.prop('scrollHeight')}, 500);
	}, 5);
}

function hide(refs) {
	for(i=0; i<refs.length; i++) {
		refs[i].addClass("hidden");
	}
}

function show(refs) {
	for(i=0; i<refs.length; i++) {
		refs[i].removeClass("hidden");
	}
}

function popupShow(state) {
	if(state) {
		popup.removeClass("hidden");
		popup.addClass("flex");
		disableButtons([popup_accept]);
	} else {
		popup.removeClass("flex");
		popup.addClass("hidden");
	}
}

function enterEditMode() {
	editmode = true;
}

function exitEditMode() {
	editmode = false;
}

function enterMemoryMode() {
	memorymode = true;
	setmodevisibility(false);
	setchatnamevisibility(false);
	showMessage("Edit the memory to be sent with each request to the AI.");
	button_actmem.html("Cancel");
	hide([button_actback, button_actfwd, button_actretry, button_actwi]);
	// Display Author's Note field
	anote_menu.slideDown("fast");
}

function exitMemoryMode() {
	memorymode = false;
	setmodevisibility(adventure);
	setchatnamevisibility(chatmode);
	hideMessage();
	button_actmem.html("Memory");
	show([button_actback, button_actfwd, button_actretry, button_actwi]);
	input_text.val("");
	// Hide Author's Note field
	anote_menu.slideUp("fast");
}

function enterWiMode() {
	showMessage("World Info will be added to memory only when the key appears in submitted text or the last action.");
	button_actwi.html("Accept");
	hide([button_actback, button_actfwd, button_actmem, button_actretry, game_text]);
	setchatnamevisibility(false);
	show([wi_menu]);
	disableSendBtn();
	$("#gamescreen").addClass("wigamescreen");
}

function exitWiMode() {
	hideMessage();
	button_actwi.html("W Info");
	hide([wi_menu]);
	setchatnamevisibility(chatmode);
	show([button_actback, button_actfwd, button_actmem, button_actretry, game_text]);
	enableSendBtn();
	$("#gamescreen").removeClass("wigamescreen");
}

function returnWiList(ar) {
	var list = [];
	var i;
	for(i=0; i<ar.length; i++) {
		var folder = $("#wilistitem"+ar[i]).parent().attr("folder-uid");
		if(folder === undefined) {
			folder = null;
		} else {
			folder = parseInt(folder);
		}
		var ob          = {"key": "", "keysecondary": "", "content": "", "comment": "", "folder": null, "uid": parseInt($("#wilistitem"+ar[i]).attr("uid")), "selective": false, "constant": false};
		ob.selective    = $("#wikeyprimary"+ar[i]).css("display") != "none"
		ob.key          = ob.selective ? $("#wikeyprimary"+ar[i]).val() : $("#wikey"+ar[i]).val();
		ob.keysecondary = $("#wikeysecondary"+ar[i]).val();
		ob.content      = $("#wientry"+ar[i]).val();
		ob.comment      = $("#wicomment"+i).val();
		ob.folder       = folder;
		ob.constant     = $("#constant-key-"+ar[i]).hasClass("constant-key-icon-enabled");
		list.push(ob);
	}
	socket.send({'cmd': 'sendwilist', 'data': list});
}

function formatChunkInnerText(chunk) {
	var text = chunk.innerText.replace(/\u00a0/g, " ");
	if((chunk.nextSibling === null || chunk.nextSibling.nodeType !== 1 || chunk.nextSibling.tagName !== "CHUNK") && text.slice(-1) === '\n') {
		return text.slice(0, -1);
	}
	return text;
}

function dosubmit(disallow_abort) {
	var txt = input_text.val().replace(/\u00a0/g, " ");
	if((disallow_abort || gamestate !== "wait") && !memorymode && !gamestarted && ((!adventure || !action_mode) && txt.trim().length == 0)) {
		return;
	}
	input_text.val("");
	hideMessage();
	hidegenseqs();
	socket.send({'cmd': 'submit', 'allowabort': !disallow_abort, 'actionmode': adventure ? action_mode : 0, 'chatname': chatmode ? chat_name.val() : undefined, 'data': txt});
}

function changemode() {
	if(gamestarted) {
		action_mode += 1;
		action_mode %= 2;  // Total number of action modes (Story and Action)
	} else {
		action_mode = 0;  // Force "Story" mode if game is not started
	}

	switch (action_mode) {
		case 0: button_mode_label.html("Story"); break;
		case 1: button_mode_label.html("Action"); break;
	}
}

function newTextHighlight(ref) {
	ref.addClass("edit-flash");
	setTimeout(function () {
		ref.addClass("colorfade");
		ref.removeClass("edit-flash");
		setTimeout(function () {
			ref.removeClass("colorfade");
		}, 1000);
	}, 50);
}

function showAidgPopup() {
	aidgpopup.removeClass("hidden");
	aidgpopup.addClass("flex");
	aidgpromptnum.focus();
}

function hideAidgPopup() {
	aidgpopup.removeClass("flex");
	aidgpopup.addClass("hidden");
}

function sendAidgImportRequest() {
	socket.send({'cmd': 'aidgimport', 'data': aidgpromptnum.val()});
	hideAidgPopup();
	aidgpromptnum.val("");
}

function showSaveAsPopup() {
	disableButtons([saveas_accept]);
	saveaspopup.removeClass("hidden");
	saveaspopup.addClass("flex");
	saveasinput.focus();
}

function hideSaveAsPopup() {
	saveaspopup.removeClass("flex");
	saveaspopup.addClass("hidden");
	saveasinput.val("");
	hide([$(".saveasoverwrite"), $(".popuperror")]);
}

function sendSaveAsRequest() {
	socket.send({'cmd': 'saveasrequest', 'data': {"name": saveasinput.val(), "pins": savepins.val()}});
}

function showLoadPopup() {
	loadpopup.removeClass("hidden");
	loadpopup.addClass("flex");
}

function hideLoadPopup() {
	loadpopup.removeClass("flex");
	loadpopup.addClass("hidden");
	loadcontent.html("");
}

function showSPPopup() {
	sppopup.removeClass("hidden");
	sppopup.addClass("flex");
}

function hideSPPopup() {
	sppopup.removeClass("flex");
	sppopup.addClass("hidden");
	spcontent.html("");
}

function showUSPopup() {
	uspopup.removeClass("hidden");
	uspopup.addClass("flex");
}

function hideUSPopup() {
	uspopup.removeClass("flex");
	uspopup.addClass("hidden");
	spcontent.html("");
}

function buildLoadList(ar) {
	disableButtons([load_accept]);
	loadcontent.html("");
	showLoadPopup();
	var i;
	for(i=0; i<ar.length; i++) {
		loadcontent.append("<div class=\"flex\">\
			<div class=\"loadlistpadding\"></div>\
			<span class=\"loadlisticon loadlisticon-delete oi oi-x "+(sman_allow_delete ? "allowed" : "")+"\" id=\"loaddelete"+i+"\" "+(sman_allow_delete ? "title=\"Delete story\"" : "")+" aria-hidden=\"true\"></span>\
			<div class=\"loadlistpadding\"></div>\
			<span class=\"loadlisticon loadlisticon-rename oi oi-pencil "+(sman_allow_rename ? "allowed" : "")+"\" id=\"loadrename"+i+"\" "+(sman_allow_rename ? "title=\"Rename story\"" : "")+" aria-hidden=\"true\"></span>\
			<div class=\"loadlistpadding\"></div>\
			<div class=\"loadlistitem\" id=\"load"+i+"\" name=\""+ar[i].name+"\">\
				<div>"+ar[i].name+"</div>\
				<div class=\"flex-push-right\">"+ar[i].actions+"</div>\
			</div>\
		</div>");
		$("#load"+i).on("click", function () {
			enableButtons([load_accept]);
			socket.send({'cmd': 'loadselect', 'data': $(this).attr("name")});
			highlightLoadLine($(this));
		});

		$("#loaddelete"+i).off("click").on("click", (function (name) {
			return function () {
				if(!sman_allow_delete) {
					return;
				}
				$("#loadcontainerdelete-storyname").text(name);
				$("#btn_dsaccept").off("click").on("click", (function (name) {
					return function () {
						hide([$(".saveasoverwrite"), $(".popuperror")]);
						socket.send({'cmd': 'deletestory', 'data': name});
					}
				})(name));
				$("#loadcontainerdelete").removeClass("hidden").addClass("flex");
			}
		})(ar[i].name));

		$("#loadrename"+i).off("click").on("click", (function (name) {
			return function () {
				if(!sman_allow_rename) {
					return;
				}
				$("#newsavename").val("")
				$("#loadcontainerrename-storyname").text(name);
				var submit = (function (name) {
					return function () {
						hide([$(".saveasoverwrite"), $(".popuperror")]);
						socket.send({'cmd': 'renamestory', 'data': name, 'newname': $("#newsavename").val()});
					}
				})(name);
				$("#btn_rensaccept").off("click").on("click", submit);
				$("#newsavename").off("keydown").on("keydown", function (ev) {
					if (ev.which == 13 && $(this).val() != "") {
						submit();
					}
				});
				$("#loadcontainerrename").removeClass("hidden").addClass("flex");
				$("#newsavename").val(name).select();
			}
		})(ar[i].name));
	}
}

function buildSPList(ar) {
	disableButtons([sp_accept]);
	spcontent.html("");
	showSPPopup();
	ar.push({filename: '', name: "[None]"})
	for(var i = 0; i < ar.length; i++) {
		var author = !ar[i].author
			? ''
			: ar[i].author.constructor === Array
			? ar[i].author.join(', ')
			: ar[i].author;
		var n_tokens = !ar[i].n_tokens || !Number.isSafeInteger(ar[i].n_tokens) || ar[i].n_tokens < 1
			? ''
			: "(" + ar[i].n_tokens + " tokens)";
		var filename = ar[i].filename.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/(?=\r|\n)\r?\n?/g, '<br/>');
		var name = ar[i].name || ar[i].filename;
		name = name.length > 120 ? name.slice(0, 117) + '...' : name;
		name = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/(?=\r|\n)\r?\n?/g, '<br/>');
		var desc = ar[i].description || '';
		desc = desc.length > 500 ? desc.slice(0, 497) + '...' : desc;
		desc = desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/(?=\r|\n)\r?\n?/g, '<br/>');
		spcontent.append("<div class=\"flex\">\
			<div class=\"splistitem flex-row-container\" id=\"sp"+i+"\" name=\""+ar[i].filename+"\">\
				<div class=\"flex-row\">\
					<div>"+name+"</div>\
					<div class=\"flex-push-right splistitemsub\">"+filename+"</div>\
				</div>\
				<div class=\"flex-row\">\
					<div>"+desc+"</div>\
					<div class=\"flex-push-right splistitemsub\">" + author + "<br/>" + n_tokens + "</div>\
				</div>\
			</div>\
		</div>");
		$("#sp"+i).on("click", function () {
			enableButtons([sp_accept]);
			socket.send({'cmd': 'spselect', 'data': $(this).attr("name")});
			highlightSPLine($(this));
		});
	}
}

function buildUSList(unloaded, loaded) {
	usunloaded.html("");
	usloaded.html("");
	showUSPopup();
	var i;
	var j;
	var el = usunloaded;
	var ar = unloaded;
	for(j=0; j<2; j++) {
		for(i=0; i<ar.length; i++) {
			el.append("<div class=\"flex\">\
				<div class=\"uslistitem flex-row-container\" name=\""+ar[i].filename+"\">\
					<div class=\"flex-row\">\
						<div>"+ar[i].modulename+"</div>\
						<div class=\"flex-push-right uslistitemsub\">&lt;"+ar[i].filename+"&gt;</div>\
					</div>\
					<div class=\"flex-row\">\
						<div>"+ar[i].description+"</div>\
					</div>\
				</div>\
			</div>");
		}
		el = usloaded;
		ar = loaded;
	}
}

function highlightLoadLine(ref) {
	$("#loadlistcontent > div > div.popuplistselected").removeClass("popuplistselected");
	ref.addClass("popuplistselected");
}

function highlightSPLine(ref) {
	$("#splistcontent > div > div.popuplistselected").removeClass("popuplistselected");
	ref.addClass("popuplistselected");
}

function showNewStoryPopup() {
	nspopup.removeClass("hidden");
	nspopup.addClass("flex");
}

function hideNewStoryPopup() {
	nspopup.removeClass("flex");
	nspopup.addClass("hidden");
}

function showRandomStoryPopup() {
	rspopup.removeClass("hidden");
	rspopup.addClass("flex");
	if($("#setrngpersist").prop("checked")) {
		$("#rngmemory").val(memorytext);
	}
}

function hideRandomStoryPopup() {
	rspopup.removeClass("flex");
	rspopup.addClass("hidden");
}

function statFlash(ref) {
	ref.addClass("status-flash");
	setTimeout(function () {
		ref.addClass("colorfade");
		ref.removeClass("status-flash");
		setTimeout(function () {
			ref.removeClass("colorfade");
		}, 1000);
	}, 50);
}

function updateUSStatItems(items, flash) {
	var stat_us = $("#stat-us");
	var stat_usactive = $("#stat-usactive");
	if(flash || stat_usactive.find("li").length != items.length) {
		statFlash(stat_us.closest(".statusicon").add("#usiconlabel"));
	}
	stat_usactive.html("");
	if(items.length == 0) {
		stat_us.html("No userscripts active");
		$("#usiconlabel").html("");
		stat_us.closest(".statusicon").removeClass("active");
		return;
	}
	stat_us.html("Active userscripts:");
	stat_us.closest(".statusicon").addClass("active");
	var i;
	for(i = 0; i < items.length; i++) {
		stat_usactive.append($("<li filename=\""+items[i].filename+"\">"+items[i].modulename+" &lt;"+items[i].filename+"&gt;</li>"));
	}
	$("#usiconlabel").html(items.length);
}

function updateSPStatItems(items) {
	var stat_sp = $("#stat-sp");
	var stat_spactive = $("#stat-spactive");
	var key = null;
	var old_val = stat_spactive.html();
	Object.keys(items).forEach(function(k) {key = k;});
	if(key === null) {
		stat_sp.html("No soft prompt active");
		stat_sp.closest(".statusicon").removeClass("active");
		stat_spactive.html("");
	} else {
		stat_sp.html("Active soft prompt (" + items[key].n_tokens + " tokens):");
		stat_sp.closest(".statusicon").addClass("active");
		stat_spactive.html((items[key].name || key)+" &lt;"+key+"&gt;");
	}
	if(stat_spactive.html() !== old_val) {
		statFlash(stat_sp.closest(".statusicon"));
	}
}

function setStartState() {
	enableSendBtn();
	enableButtons([button_actmem, button_actwi]);
	disableButtons([button_actback, button_actfwd, button_actretry]);
	hide([wi_menu]);
	show([game_text, button_actmem, button_actwi, button_actback, button_actfwd, button_actretry]);
	hideMessage();
	hideWaitAnimation();
	button_actmem.html("Memory");
	button_actwi.html("W Info");
	hideAidgPopup();
	hideSaveAsPopup();
	hideLoadPopup();
	hideNewStoryPopup();
	hidegenseqs();
}

function parsegenseqs(seqs) {
	seqselcontents.html("");
	var i;
	for(i=0; i<seqs.length; i++) {
		//setup selection data
		text_data = "<table><tr><td width=100%><div class=\"seqselitem\" id=\"seqsel"+i+"\" n=\""+i+"\">"+seqs[i][0]+"</div></td><td width=10>"
		
		//Now do the icon (pin/redo)
		
		if (seqs[i][1] == "redo") {
			text_data = text_data + "<span style=\"color: white\" class=\"oi oi-loop-circular\" title=\"Redo\" aria-hidden=\"true\" id=\"seqselpin"+i+"\" n=\""+i+"\"></span>"
		} else if (seqs[i][1] == "pinned") {
			text_data = text_data + "<span style=\"color: white\" class=\"oi oi-pin\" title=\"Pin\" aria-hidden=\"true\" id=\"seqselpin"+i+"\" n=\""+i+"\"></span>"
		} else {
			text_data = text_data + "<span style=\"color: grey\" class=\"oi oi-pin\" title=\"Pin\" aria-hidden=\"true\" id=\"seqselpin"+i+"\" n=\""+i+"\"></span>"
		}
		text_data = text_data + "</td></tr></table>"
		seqselcontents.append(text_data);
		
		//setup on-click actions
		$("#seqsel"+i).on("click", function () {
			socket.send({'cmd': 'seqsel', 'data': $(this).attr("n")});
		});
		
		//onclick for pin only
		if (seqs[i][1] != "redo") {
			$("#seqselpin"+i).on("click", function () {
				socket.send({'cmd': 'seqpin', 'data': $(this).attr("n")});
				if ($(this).attr("style") == "color: grey") {
					console.log($(this).attr("style"));
					$(this).css({"color": "white"});
					console.log($(this).attr("style"));
				} else {
					console.log($(this).attr("style"));
					$(this).css({"color": "grey"});
					console.log($(this).attr("style"));
				}
			});
		}
	}
	$('#seqselmenu').slideDown("slow");
}

function hidegenseqs() {
	$('#seqselmenu').slideUp("slow", function() {
		seqselcontents.html("");
	});
	scrollToBottom();
}

function setmodevisibility(state) {
	if(state){  // Enabling
		show([button_mode]);
		$("#inputrow").addClass("show_mode");
	} else{  // Disabling
		hide([button_mode]);
		$("#inputrow").removeClass("show_mode");
	}
}

function setchatnamevisibility(state) {
	if(state){  // Enabling
		show([chat_name]);
	} else{  // Disabling
		hide([chat_name]);
	}
}

function setadventure(state) {
	adventure = state;
	if(state) {
		game_text.addClass("adventure");
	} else {
		game_text.removeClass("adventure");
	}
	if(!memorymode){
		setmodevisibility(state);
	}
}

function setchatmode(state) {
	chatmode = state;
	setchatnamevisibility(state);
}

function autofocus(event) {
	if(connected) {
		event.target.focus();
	} else {
		event.preventDefault();
	}
}

function sortableOnStart(event, ui) {
}

function sortableOnStop(event, ui) {
	if(ui.item.hasClass("wilistitem")) {
		// When a WI entry is dragged and dropped, tell the server which WI
		// entry was dropped and which WI entry comes immediately after the
		// dropped position so that the server can internally move around
		// the WI entries
		var next_sibling = ui.item.next(".wilistitem").attr("uid");
		if(next_sibling === undefined) {
			next_sibling = ui.item.next().next().attr("uid");
		}
		next_sibling = parseInt(next_sibling);
		if(Number.isNaN(next_sibling)) {
			$(this).sortable("cancel");
			return;
		}
		socket.send({'cmd': 'wimoveitem', 'destination': next_sibling, 'data': parseInt(ui.item.attr("uid"))});
	} else {
		// Do the same thing for WI folders
		var next_sibling = ui.item.next(".wisortable-container").attr("folder-uid");
		if(next_sibling === undefined) {
			next_sibling = null;
		} else {
			next_sibling = parseInt(next_sibling);
		}
		if(Number.isNaN(next_sibling)) {
			$(this).sortable("cancel");
			return;
		}
		socket.send({'cmd': 'wimovefolder', 'destination': next_sibling, 'data': parseInt(ui.item.attr("folder-uid"))});
	}
}

function chunkOnTextInput(event) {
	// The enter key does not behave correctly in almost all non-Firefox
	// browsers, so we (attempt to) shim all enter keystrokes here to behave the
	// same as in Firefox
	if(event.originalEvent.data.slice(-1) === '\n') {
		event.preventDefault();
		var s = getSelection();  // WARNING: Do not use rangy.getSelection() instead of getSelection()
		var r = s.getRangeAt(0);

		// We prefer using document.execCommand here because it works best on
		// mobile devices, but the other method is also here as
		// a fallback
		if(document.queryCommandSupported && document.execCommand && document.queryCommandSupported('insertHTML')) {
			document.execCommand('insertHTML', false, event.originalEvent.data.slice(0, -1).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/(?=\r|\n)\r?\n?/g, '<br/>') + '<br id="_EDITOR_LINEBREAK_"/><span id="_EDITOR_SENTINEL_">|</span>');
			var t = $('#_EDITOR_SENTINEL_').contents().filter(function() { return this.nodeType === 3; })[0];
		} else {
			var t = document.createTextNode('|');
			var b = document.createElement('br');
			b.id = "_EDITOR_LINEBREAK_";
			r.insertNode(b);
			r.collapse(false);
			r.insertNode(t);
		}

		r.selectNodeContents(t);
		s.removeAllRanges();
		s.addRange(r);
		if(document.queryCommandSupported && document.execCommand && document.queryCommandSupported('forwardDelete')) {
			r.collapse(true);
			document.execCommand('forwardDelete');
		} else {
			// deleteContents() sometimes breaks using the left
			// arrow key in some browsers so we prefer the
			// document.execCommand method
			r.deleteContents();
		}

		// In Chrome the added <br/> will go outside of the chunks if we press
		// enter at the end of the story in the editor, so this is here
		// to put the <br/> back in the right place
		var br = $("#_EDITOR_LINEBREAK_")[0];
		if(br.parentNode === game_text[0]) {
			if(br.previousSibling.nodeType !== 1) {
				br.previousSibling.previousSibling.appendChild(br.previousSibling);
			}
			br.previousSibling.appendChild(br);
			r.selectNodeContents(br.parentNode);
			s.removeAllRanges();
			s.addRange(r);
			r.collapse(false);
		}
		br.id = "";
		if(game_text[0].lastChild.tagName === "BR") {
			br.parentNode.appendChild(game_text[0].lastChild);
		}
		return;
	}
}

// This gets run when one or more chunks are edited.  The event occurs before
// the actual edits are made by the browser, so we are free to check which
// nodes are selected or stop the event from occurring.
function chunkOnBeforeInput(event) {
	// Register all selected chunks as having been modified
	applyChunkDeltas(getSelectedNodes());

	// Fix editing across chunks and paragraphs in Firefox 93.0 and higher
	if(event.originalEvent.inputType === "deleteContentBackward" && document.queryCommandSupported && document.execCommand && document.queryCommandSupported('delete')) {
		event.preventDefault();
		document.execCommand('delete');
	}
	var s = rangy.getSelection();
	if(!s.isCollapsed) {
		s.deleteFromDocument();
	}
	if(buildChunkSetFromNodeArray(getSelectedNodes()).size === 0) {
		var s = rangy.getSelection();
		var r = s.getRangeAt(0);
		if(document.queryCommandSupported && document.execCommand && document.queryCommandSupported('insertHTML')) {
			document.execCommand('insertHTML', false, '<span id="_EDITOR_SENTINEL_">|</span>');
		} else {
			var t = document.createTextNode('|');
			var b = document.createElement('span');
			b.id = "_EDITOR_SENTINEL_";
			b.insertNode(t);
			r.insertNode(b);
		}
		var sentinel = document.getElementById("_EDITOR_SENTINEL_");
		if(sentinel.nextSibling && sentinel.nextSibling.tagName === "CHUNK") {
			r.selectNodeContents(sentinel.nextSibling);
			r.collapse(true);
		} else if(sentinel.previousSibling && sentinel.previousSibling.tagName === "CHUNK") {
			r.selectNodeContents(sentinel.previousSibling);
			r.collapse(false);
		}
		s.removeAllRanges();
		s.addRange(r);
		sentinel.parentNode.removeChild(sentinel);
	}
}

function chunkOnKeyDown(event) {
	// Make escape commit the changes (Originally we had Enter here to but its not required and nicer for users if we let them type freely
	// You can add the following after 27 if you want it back to committing on enter : || (!event.shiftKey && event.keyCode == 13)
	if(event.keyCode == 27) {
		override_focusout = true;
		game_text.blur();
		event.preventDefault();
		return;
	}

	// Don't allow any edits if not connected to server
	if(!connected) {
		event.preventDefault();
		return;
	}

	// Prevent CTRL+B, CTRL+I and CTRL+U when editing chunks
	if(event.ctrlKey || event.metaKey) {  // metaKey is macOS's command key
		switch(event.keyCode) {
			case 66:
			case 98:
			case 73:
			case 105:
			case 85:
			case 117:
				event.preventDefault();
				return;
		}
	}
}

function downloadStory(format) {
	var filename_without_extension = storyname !== null ? storyname : "untitled";

	var anchor = document.createElement('a');

	var actionlist = $("chunk");
	var actionlist_compiled = [];
	for(var i = 0; i < actionlist.length; i++) {
		actionlist_compiled.push(actionlist[i].innerText.replace(/\u00a0/g, " "));
	}
	var last = actionlist_compiled[actionlist_compiled.length-1];
	if(last && last.slice(-1) === '\n') {
		actionlist_compiled[actionlist_compiled.length-1] = last.slice(0, -1);
	}

	if(format == "plaintext") {
		var objectURL = URL.createObjectURL(new Blob(actionlist_compiled, {type: "text/plain; charset=UTF-8"}));
		anchor.setAttribute('href', objectURL);
		anchor.setAttribute('download', filename_without_extension + ".txt");
		anchor.click();
		URL.revokeObjectURL(objectURL);
		return;
	}

	var wilist = $(".wilistitem");
	var wilist_compiled = [];
	for(var i = 0; i < wilist.length; i++) {
		if(wilist[i].classList.contains("wilistitem-uninitialized")) {
			continue;
		}
		var selective = wilist[i].classList.contains("wilistitem-selective");
		var folder = $("#wilistitem"+i).parent().attr("folder-uid");
		if(folder === undefined) {
			folder = null;
		} else {
			folder = parseInt(folder);
		}
		wilist_compiled.push({
			key: selective ? $("#wikeyprimary"+i).val() : $("#wikey"+i).val(),
			keysecondary: $("#wikeysecondary"+i).val(),
			content: $("#wientry"+i).val(),
			comment: $("#wicomment"+i).val(),
			folder: folder,
			selective: selective,
			constant: wilist[i].classList.contains("wilistitem-constant"),
		});
	}

	var prompt = actionlist_compiled.shift();
	if(prompt === undefined) {
		prompt = "";
	}
	var objectURL = URL.createObjectURL(new Blob([JSON.stringify({
		gamestarted: gamestarted,
		prompt: prompt,
		memory: memorytext,
		authorsnote: $("#anoteinput").val(),
		anotetemplate: $("#anotetemplate").val(),
		actions: actionlist_compiled,
		worldinfo: wilist_compiled,
		wifolders_d: wifolders_d,
		wifolders_l: wifolders_l,
	}, null, 3)], {type: "application/json; charset=UTF-8"}));
	anchor.setAttribute('href', objectURL);
	anchor.setAttribute('download', filename_without_extension + ".json");
	anchor.click();
	URL.revokeObjectURL(objectURL);
}

function buildChunkSetFromNodeArray(nodes) {
	var set = new Set();
	for(var i = 0; i < nodes.length; i++) {
		node = nodes[i];
		while(node !== null && node.tagName !== "CHUNK") {
			node = node.parentNode;
		}
		if(node === null) {
			continue;
		}
		set.add(node.getAttribute("n"));
	}
	return set;
}

function getSelectedNodes() {
	var range = rangy.getSelection().getRangeAt(0);  // rangy is not a typo
	var nodes = range.getNodes([1,3]);
	nodes.push(range.startContainer);
	nodes.push(range.endContainer);
	return nodes
}

function applyChunkDeltas(nodes) {
	var chunks = Array.from(buildChunkSetFromNodeArray(nodes));
	for(var i = 0; i < chunks.length; i++) {
		modified_chunks.add(chunks[i]);
	}
	setTimeout(function() {
		var chunks = Array.from(modified_chunks);
		var selected_chunks = buildChunkSetFromNodeArray(getSelectedNodes());
		for(var i = 0; i < chunks.length; i++) {
			var chunk = document.getElementById("n" + chunks[i]);
			if(chunk && formatChunkInnerText(chunk).length != 0 && chunks[i] != '0') {
				if(!selected_chunks.has(chunks[i])) {
					modified_chunks.delete(chunks[i]);
					socket.send({'cmd': 'inlineedit', 'chunk': chunks[i], 'data': formatChunkInnerText(chunk)});
				}
				empty_chunks.delete(chunks[i]);
			} else {
				if(!selected_chunks.has(chunks[i])) {
					modified_chunks.delete(chunks[i]);
					socket.send({'cmd': 'inlineedit', 'chunk': chunks[i], 'data': ''});
				}
				empty_chunks.add(chunks[i]);
			}
		}
	}, 2);
}

function syncAllModifiedChunks(including_selected_chunks=false) {
	var chunks = Array.from(modified_chunks);
	var selected_chunks = buildChunkSetFromNodeArray(getSelectedNodes());
	for(var i = 0; i < chunks.length; i++) {
		if(including_selected_chunks || !selected_chunks.has(chunks[i])) {
			modified_chunks.delete(chunks[i]);
			var chunk = document.getElementById("n" + chunks[i]);
			var data = chunk ? formatChunkInnerText(document.getElementById("n" + chunks[i])) : "";
			if(data.length == 0) {
				empty_chunks.add(chunks[i]);
			} else {
				empty_chunks.delete(chunks[i]);
			}
			socket.send({'cmd': 'inlineedit', 'chunk': chunks[i], 'data': data});
		}
	}
}

function restorePrompt() {
	if($("#n0").length && formatChunkInnerText($("#n0")[0]).length === 0) {
		$("#n0").remove();
	}
	var shadow_text = $("<b>" + game_text.html() + "</b>");
	var detected = false;
	var ref = null;
	try {
		if(shadow_text.length && shadow_text[0].firstChild && (shadow_text[0].firstChild.nodeType === 3 || shadow_text[0].firstChild.tagName === "BR")) {
			detected = true;
			ref = shadow_text;
		} else if(game_text.length && game_text[0].firstChild && (game_text[0].firstChild.nodeType === 3 || game_text[0].firstChild.tagName === "BR")) {
			detected = true;
			ref = game_text;
		}
	} catch (e) {
		detected = false;
	}
	if(detected) {
		unbindGametext();
		var text = [];
		while(true) {
			if(ref.length && ref[0].firstChild && ref[0].firstChild.nodeType === 3) {
				text.push(ref[0].firstChild.textContent.replace(/\u00a0/g, " "));
			} else if(ref.length && ref[0].firstChild && ref[0].firstChild.tagName === "BR") {
				text.push("\n");
			} else {
				break;
			}
			ref[0].removeChild(ref[0].firstChild);
		}
		text = text.join("").trim();
		if(text.length) {
			saved_prompt = text;
		}
		game_text[0].innerHTML = "";
		bindGametext();
	}
	game_text.children().each(function() {
		if(this.tagName !== "CHUNK") {
			this.parentNode.removeChild(this);
		}
	});
	if(!detected) {
		game_text.children().each(function() {
			if(this.innerText.trim().length) {
				saved_prompt = this.innerText.trim();
				socket.send({'cmd': 'inlinedelete', 'data': this.getAttribute("n")});
				this.parentNode.removeChild(this);
				return false;
			}
			socket.send({'cmd': 'inlinedelete', 'data': this.getAttribute("n")});
			this.parentNode.removeChild(this);
		});
	}
	var prompt_chunk = document.createElement("chunk");
	prompt_chunk.setAttribute("n", "0");
	prompt_chunk.setAttribute("id", "n0");
	prompt_chunk.setAttribute("tabindex", "-1");
	prompt_chunk.innerText = saved_prompt;
	unbindGametext();
	game_text[0].prepend(prompt_chunk);
	bindGametext();
	modified_chunks.delete('0');
	empty_chunks.delete('0');
	socket.send({'cmd': 'inlineedit', 'chunk': '0', 'data': saved_prompt});
}

function deleteEmptyChunks() {
	var chunks = Array.from(empty_chunks);
	for(var i = 0; i < chunks.length; i++) {
		empty_chunks.delete(chunks[i]);
		if(chunks[i] === "0") {
			// Don't delete the prompt
			restorePrompt();
		} else {
			socket.send({'cmd': 'inlinedelete', 'data': chunks[i]});
		}
	}
	if(modified_chunks.has('0')) {
		modified_chunks.delete(chunks[i]);
		socket.send({'cmd': 'inlineedit', 'chunk': chunks[i], 'data': formatChunkInnerText(document.getElementById("n0"))});
	}
	saved_prompt = formatChunkInnerText($("#n0")[0]);
}

function highlightEditingChunks() {
	var chunks = $('chunk.editing').toArray();
	var selected_chunks = buildChunkSetFromNodeArray(getSelectedNodes());
	for(var i = 0; i < chunks.length; i++) {
		var chunk = chunks[i];
		if(!selected_chunks.has(chunks[i].getAttribute("n"))) {
			unbindGametext();
			$(chunk).removeClass('editing');
			bindGametext();
		}
	}
	chunks = Array.from(selected_chunks);
	for(var i = 0; i < chunks.length; i++) {
		var chunk = $("#n"+chunks[i]);
		unbindGametext();
		chunk.addClass('editing');
		bindGametext();
	}
}

// This gets run every time the text in a chunk is edited
// or a chunk is deleted
function chunkOnDOMMutate(mutations, observer) {
	if(!gametext_bound || !allowedit) {
		return;
	}
	var nodes = [];
	for(var i = 0; i < mutations.length; i++) {
		var mutation = mutations[i];
		nodes = nodes.concat(Array.from(mutation.addedNodes), Array.from(mutation.removedNodes));
		nodes.push(mutation.target);
	}
	applyChunkDeltas(nodes);
}

// This gets run every time you try to paste text into the editor
function chunkOnPaste(event) {
	// Register the chunk we're pasting in as having been modified
	applyChunkDeltas(getSelectedNodes());

	// If possible, intercept paste events into the editor in order to always
	// paste as plaintext
	if(event.originalEvent.clipboardData && document.queryCommandSupported && document.execCommand && document.queryCommandSupported('insertHTML')) {
		event.preventDefault();
        document.execCommand('insertHTML', false, event.originalEvent.clipboardData.getData('text/plain').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/(?=\r|\n)\r?\n?/g, '<br/>'));
    } else if (event.originalEvent.clipboardData) {
		event.preventDefault();
		var s = getSelection();  // WARNING: Do not use rangy.getSelection() instead of getSelection()
		var r = s.getRangeAt(0);
		r.deleteContents();
		var nodes = Array.from($('<span>' + event.originalEvent.clipboardData.getData('text/plain').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/(?=\r|\n)\r?\n?/g, '<br/>') + '</span>')[0].childNodes);
		for(var i = 0; i < nodes.length; i++) {
			r.insertNode(nodes[i]);
			r.collapse(false);
		}
	}
}

// This gets run every time the caret moves in the editor
function _chunkOnSelectionChange(event, do_blur_focus) {
	if(!gametext_bound || !allowedit || override_focusout) {
		override_focusout = false;
		return;
	}
	setTimeout(function() {
		syncAllModifiedChunks();
		setTimeout(function() {
			highlightEditingChunks();
			// Attempt to prevent Chromium-based browsers on Android from
			// scrolling away from the current selection
			if(do_blur_focus && !using_webkit_patch) {
				setTimeout(function() {
					game_text.blur();
					game_text.focus();
				}, 144);
			}
		}, 2);
	}, 2);
}

function chunkOnSelectionChange(event) {
	return _chunkOnSelectionChange(event, true);
}

function chunkOnKeyDownSelectionChange(event) {
	return _chunkOnSelectionChange(event, false);
}

// This gets run when you defocus the editor by clicking
// outside of the editor or by pressing escape or tab
function chunkOnFocusOut(event) {
	if(!gametext_bound || !allowedit || event.target !== game_text[0]) {
		return;
	}
	setTimeout(function() {
		if(document.activeElement === game_text[0] || game_text[0].contains(document.activeElement)) {
			return;
		}
		syncAllModifiedChunks(true);
		setTimeout(function() {
			var blurred = game_text[0] !== document.activeElement;
			if(blurred) {
				deleteEmptyChunks();
			}
			setTimeout(function() {
				$("chunk").removeClass('editing');
			}, 2);
		}, 2);
	}, 2);
}

function bindGametext() {
	mutation_observer.observe(game_text[0], {characterData: true, childList: true, subtree: true});
	gametext_bound = true;
}

function unbindGametext() {
	mutation_observer.disconnect();
	gametext_bound = false;
}

//=================================================================//
//  READY/RUNTIME
//=================================================================//

$(document).ready(function(){
	
	// Bind UI references
	connect_status    = $('#connectstatus');
	button_newgame    = $('#btn_newgame');
	button_rndgame    = $('#btn_rndgame');
	button_save       = $('#btn_save');
	button_saveas     = $('#btn_saveas');
	button_savetofile = $('#btn_savetofile');
	button_download   = $('#btn_download');
	button_downloadtxt= $('#btn_downloadtxt');
	button_load       = $('#btn_load');
	button_loadfrfile = $('#btn_loadfromfile');
	button_import     = $("#btn_import");
	button_importwi   = $("#btn_importwi");
	button_impaidg    = $("#btn_impaidg");
	button_settings   = $('#btn_settings');
	button_format     = $('#btn_format');
	button_softprompt = $("#btn_softprompt");
	button_userscripts= $("#btn_userscripts");
	button_mode       = $('#btnmode')
	button_mode_label = $('#btnmode_label')
	button_send       = $('#btnsend');
	button_actmem     = $('#btn_actmem');
	button_actback    = $('#btn_actundo');
	button_actfwd     = $('#btn_actredo');
	button_actretry   = $('#btn_actretry');
	button_actwi      = $('#btn_actwi');
	game_text         = $('#gametext');
	input_text        = $('#input_text');
	message_text      = $('#messagefield');
	chat_name         = $('#chatname');
	settings_menu     = $("#settingsmenu");
	format_menu       = $('#formatmenu');
	anote_menu        = $('#anoterowcontainer');
	debug_area        = $('#debugcontainer');
	wi_menu           = $('#wimenu');
	anote_input       = $('#anoteinput');
	anote_labelcur    = $('#anotecur');
	anote_slider      = $('#anotedepth');
	popup             = $("#popupcontainer");
	popup_title       = $("#popuptitletext");
	popup_content     = $("#popupcontent");
	popup_accept      = $("#btn_popupaccept");
	popup_close       = $("#btn_popupclose");
	aidgpopup         = $("#aidgpopupcontainer");
	aidgpromptnum     = $("#aidgpromptnum");
	aidg_accept       = $("#btn_aidgpopupaccept");
	aidg_close        = $("#btn_aidgpopupclose");
	saveaspopup       = $("#saveascontainer");
	saveasinput       = $("#savename");
	savepins          = $("#savepins");
	topic             = $("#topic");
	saveas_accept     = $("#btn_saveasaccept");
	saveas_close      = $("#btn_saveasclose");
	loadpopup         = $("#loadcontainer");
	loadcontent       = $("#loadlistcontent");
	load_accept       = $("#btn_loadaccept");
	load_close        = $("#btn_loadclose");
	sppopup           = $("#spcontainer");
	spcontent         = $("#splistcontent");
	sp_accept         = $("#btn_spaccept");
	sp_close          = $("#btn_spclose");
	uspopup           = $("#uscontainer");
	usunloaded        = $("#uslistunloaded");
	usloaded          = $("#uslistloaded");
	us_accept         = $("#btn_usaccept");
	us_close          = $("#btn_usclose");
	nspopup           = $("#newgamecontainer");
	ns_accept         = $("#btn_nsaccept");
	ns_close          = $("#btn_nsclose");
	rspopup           = $("#rndgamecontainer");
	rs_accept         = $("#btn_rsaccept");
	rs_close          = $("#btn_rsclose");
	seqselmenu        = $("#seqselmenu");
	seqselcontents    = $("#seqselcontents");

	// Connect to SocketIO server
	socket = io.connect(window.document.origin, {transports: ['polling', 'websocket'], closeOnBeforeunload: false});

	socket.on('from_server', function(msg) {
		if(msg.cmd == "connected") {
			// Connected to Server Actions
			sman_allow_delete = msg.hasOwnProperty("smandelete") && msg.smandelete;
			sman_allow_rename = msg.hasOwnProperty("smanrename") && msg.smanrename;
			connected = true;
			if(msg.hasOwnProperty("modelname")) {
				modelname = msg.modelname;
			}
			refreshTitle();
			connect_status.html("<b>Connected to KoboldAI Process!</b>");
			connect_status.removeClass("color_orange");
			connect_status.addClass("color_green");
			// Reset Menus
			settings_menu.html("");
			format_menu.html("");
			wi_menu.html("");
			// Set up "Allow Editing"
			$('body').on('input', autofocus);
			$('#allowediting').prop('checked', allowedit).prop('disabled', false).change().off('change').on('change', function () {
				if(allowtoggle) {
					allowedit = gamestarted && $(this).prop('checked');
					game_text.attr('contenteditable', allowedit);
				}
			});
			// A simple feature detection test to determine whether the user interface
			// is using WebKit (Safari browser's rendering engine) because WebKit
			// requires special treatment to work correctly with the KoboldAI editor
			(function() {
				var active_element = document.activeElement;
				var c = document.createElement("chunk");
				var t = document.createTextNode("KoboldAI");
				c.appendChild(t);
				game_text[0].appendChild(c);
				var r = rangy.createRange();
				r.setStart(t, 6);
				r.collapse(true);
				var s = rangy.getSelection();
				s.removeAllRanges();
				s.addRange(r);
				game_text.blur();
				game_text.focus();
				using_webkit_patch = rangy.getSelection().focusOffset !== 6;
				c.removeChild(t);
				game_text[0].removeChild(c);
				document.activeElement.blur();
				active_element.focus();
			})();
			$("body").addClass("connected");
		} else if(msg.cmd == "updatescreen") {
			var _gamestarted = gamestarted;
			gamestarted = msg.gamestarted;
			if(_gamestarted != gamestarted) {
				action_mode = 0;
				changemode();
			}
			unbindGametext();
			allowedit = gamestarted && $("#allowediting").prop('checked');
			game_text.attr('contenteditable', allowedit);
			modified_chunks = new Set();
			empty_chunks = new Set();
			game_text.html(msg.data);
			if(game_text[0].lastChild !== null && game_text[0].lastChild.tagName === "CHUNK") {
				game_text[0].lastChild.appendChild(document.createElement("br"));
			}
			bindGametext();
			if(gamestarted) {
				saved_prompt = formatChunkInnerText($("#n0")[0]);
			}
			// Scroll to bottom of text
			if(newly_loaded) {
				scrollToBottom();
			}
			newly_loaded = false;
		} else if(msg.cmd == "scrolldown") {
			scrollToBottom();
		} else if(msg.cmd == "updatechunk") {
			hideMessage();
			var index = msg.data.index;
			var html = msg.data.html;
			var existingChunk = game_text.children('#n' + index);
			var newChunk = $(html);
			unbindGametext();
			if (existingChunk.length > 0) {
				// Update existing chunk
				if(existingChunk[0].nextSibling === null || existingChunk[0].nextSibling.nodeType !== 1 || existingChunk[0].nextSibling.tagName !== "CHUNK") {
					newChunk[0].appendChild(document.createElement("br"));
				}
				existingChunk.before(newChunk);
				existingChunk.remove();
			} else if (!empty_chunks.has(index.toString())) {
				// Append at the end
				unbindGametext();
				var lc = game_text[0].lastChild;
				if(lc.tagName === "CHUNK" && lc.lastChild !== null && lc.lastChild.tagName === "BR") {
					lc.removeChild(lc.lastChild);
				}
				newChunk[0].appendChild(document.createElement("br"));
				game_text.append(newChunk);
				bindGametext();
			}
			bindGametext();
			hide([$('#curtain')]);
		} else if(msg.cmd == "removechunk") {
			hideMessage();
			var index = msg.data;
			var element = game_text.children('#n' + index);
			if(element.length) {
				unbindGametext();
				if((element[0].nextSibling === null || element[0].nextSibling.nodeType !== 1 || element[0].nextSibling.tagName !== "CHUNK") && element[0].previousSibling !== null && element[0].previousSibling.tagName === "CHUNK") {
					element[0].previousSibling.appendChild(document.createElement("br"));
				}
				element.remove();  // Remove the chunk
				bindGametext();
			}
			hide([$('#curtain')]);
		} else if(msg.cmd == "setgamestate") {
			// Enable or Disable buttons
			if(msg.data == "ready") {
				enableSendBtn();
				enableButtons([button_actmem, button_actwi, button_actback, button_actfwd, button_actretry]);
				hideWaitAnimation();
				gamestate = "ready";
			} else if(msg.data == "wait") {
				gamestate = "wait";
				disableSendBtn();
				disableButtons([button_actmem, button_actwi, button_actback, button_actfwd, button_actretry]);
				showWaitAnimation();
			} else if(msg.data == "start") {
				setStartState();
				gamestate = "ready";
			}
		} else if(msg.cmd == "allowsp") {
			allowsp = !!msg.data;
			if(allowsp) {
				button_softprompt.removeClass("hidden");
			} else {
				button_softprompt.addClass("hidden");
			}
		} else if(msg.cmd == "setstoryname") {
			storyname = msg.data;
			refreshTitle();
		} else if(msg.cmd == "editmode") {
			// Enable or Disable edit mode
			if(msg.data == "true") {
				enterEditMode();
			} else {
				exitEditMode();
			}
		} else if(msg.cmd == "setinputtext") {
			// Set input box text for memory mode
			if(memorymode) {
				memorytext = msg.data;
				input_text.val(msg.data);
			}
		} else if(msg.cmd == "setmemory") {
			memorytext = msg.data;
			if(memorymode) {
				input_text.val(msg.data);
			}
		} else if(msg.cmd == "memmode") {
			// Enable or Disable memory edit mode
			if(msg.data == "true") {
				enterMemoryMode();
			} else {
				exitMemoryMode();
			}
		} else if(msg.cmd == "errmsg") {
			// Send error message
			errMessage(msg.data, "error");
		} else if(msg.cmd == "warnmsg") {
			// Send warning message
			errMessage(msg.data, "warn");
		} else if(msg.cmd == "hidemsg") {
			hideMessage();
		} else if(msg.cmd == "texteffect") {
			// Apply color highlight to line of text
			newTextHighlight($("#n"+msg.data))
		} else if(msg.cmd == "updatetemp") {
			// Send current temp value to input
			$("#settemp").val(parseFloat(msg.data));
			$("#settempcur").html(msg.data);
		} else if(msg.cmd == "updatetopp") {
			// Send current top p value to input
			$("#settopp").val(parseFloat(msg.data));
			$("#settoppcur").html(msg.data);
		} else if(msg.cmd == "updatetopk") {
			// Send current top k value to input
			$("#settopk").val(parseFloat(msg.data));
			$("#settopkcur").html(msg.data);
		} else if(msg.cmd == "updatetfs") {
			// Send current tfs value to input
			$("#settfs").val(parseFloat(msg.data));
			$("#settfscur").html(msg.data);
		} else if(msg.cmd == "updatereppen") {
			// Send current rep pen value to input
			$("#setreppen").val(parseFloat(msg.data));
			$("#setreppencur").html(msg.data);
		} else if(msg.cmd == "updatereppenslope") {
			// Send current rep pen value to input
			$("#setreppenslope").val(parseFloat(msg.data));
			$("#setreppenslopecur").html(msg.data);
		} else if(msg.cmd == "updatereppenrange") {
			// Send current rep pen value to input
			$("#setreppenrange").val(parseFloat(msg.data));
			$("#setreppenrangecur").html(msg.data);
		} else if(msg.cmd == "updateoutlen") {
			// Send current output amt value to input
			$("#setoutput").val(parseInt(msg.data));
			$("#setoutputcur").html(msg.data);
		} else if(msg.cmd == "updatetknmax") {
			// Send current max tokens value to input
			$("#settknmax").val(parseInt(msg.data));
			$("#settknmaxcur").html(msg.data);
		} else if(msg.cmd == "updateikgen") {
			// Send current max tokens value to input
			$("#setikgen").val(parseInt(msg.data));
			$("#setikgencur").html(msg.data);
		} else if(msg.cmd == "setlabeltemp") {
			// Update setting label with value from server
			$("#settempcur").html(msg.data);
		} else if(msg.cmd == "setlabeltopp") {
			// Update setting label with value from server
			$("#settoppcur").html(msg.data);
		} else if(msg.cmd == "setlabeltopk") {
			// Update setting label with value from server
			$("#settopkcur").html(msg.data);
		} else if(msg.cmd == "setlabeltfs") {
			// Update setting label with value from server
			$("#settfscur").html(msg.data);
		} else if(msg.cmd == "setlabelreppen") {
			// Update setting label with value from server
			$("#setreppencur").html(msg.data);
		} else if(msg.cmd == "setlabelreppenslope") {
			// Update setting label with value from server
			$("#setreppenslopecur").html(msg.data);
		} else if(msg.cmd == "setlabelreppenrange") {
			// Update setting label with value from server
			$("#setreppenrangecur").html(msg.data);
		} else if(msg.cmd == "setlabeloutput") {
			// Update setting label with value from server
			$("#setoutputcur").html(msg.data);
		} else if(msg.cmd == "setlabeltknmax") {
			// Update setting label with value from server
			$("#settknmaxcur").html(msg.data);
		} else if(msg.cmd == "setlabelikgen") {
			// Update setting label with value from server
			$("#setikgencur").html(msg.data);
		} else if(msg.cmd == "updateanotedepth") {
			// Send current Author's Note depth value to input
			anote_slider.val(parseInt(msg.data));
			anote_labelcur.html(msg.data);
		} else if(msg.cmd == "setlabelanotedepth") {
			// Update setting label with value from server
			anote_labelcur.html(msg.data);
		} else if(msg.cmd == "getanote") {
			// Request contents of Author's Note field
			var txt = anote_input.val();
			socket.send({'cmd': 'anote', 'template': $("#anotetemplate").val(), 'data': txt});
		} else if(msg.cmd == "setanote") {
			// Set contents of Author's Note field
			anote_input.val(msg.data);
		} else if(msg.cmd == "setanotetemplate") {
			// Set contents of Author's Note Template field
			$("#anotetemplate").val(msg.data);
		} else if(msg.cmd == "addsetting") {
			// Add setting controls
			addSetting(msg.data);
		} else if(msg.cmd == "addformat") {
			// Add setting controls
			addFormat(msg.data);
		} else if(msg.cmd == "updatefrmttriminc") {
			// Update toggle state
			$("#frmttriminc").prop('checked', msg.data).change();
		} else if(msg.cmd == "updatefrmtrmblln") {
			// Update toggle state
			$("#frmtrmblln").prop('checked', msg.data).change();
		} else if(msg.cmd == "updatefrmtrmspch") {
			// Update toggle state
			$("#frmtrmspch").prop('checked', msg.data).change();
		} else if(msg.cmd == "updatefrmtadsnsp") {
			// Update toggle state
			$("#frmtadsnsp").prop('checked', msg.data).change();
		} else if(msg.cmd == "updatesingleline") {
			// Update toggle state
			$("#singleline").prop('checked', msg.data).change();
		} else if(msg.cmd == "allowtoggle") {
			// Allow toggle change states to propagate
			allowtoggle = msg.data;
		} else if(msg.cmd == "usstatitems") {
			updateUSStatItems(msg.data, msg.flash);
		} else if(msg.cmd == "spstatitems") {
			updateSPStatItems(msg.data);
		} else if(msg.cmd == "popupshow") {
			// Show/Hide Popup
			popupShow(msg.data);
		} else if(msg.cmd == "hidepopupdelete") {
			// Hide the dialog box that asks you to confirm deletion of a story
			$("#loadcontainerdelete").removeClass("flex").addClass("hidden");
			hide([$(".saveasoverwrite"), $(".popuperror")]);
		} else if(msg.cmd == "hidepopuprename") {
			// Hide the story renaming dialog box
			$("#loadcontainerrename").removeClass("flex").addClass("hidden");
			hide([$(".saveasoverwrite"), $(".popuperror")]);
		} else if(msg.cmd == "addimportline") {
			// Add import popup entry
			addImportLine(msg.data);
		} else if(msg.cmd == "clearpopup") {
			// Clear previous contents of popup
			popup_content.html("");
		} else if(msg.cmd == "wimode") {
			// Enable or Disable WI edit mode
			if(msg.data == "true") {
				enterWiMode();
			} else {
				exitWiMode();
			}
		} else if(msg.cmd == "wiupdate") {
			var selective = $("#wilistitem"+msg.num)[0].classList.contains("wilistitem-selective");
			if(selective) {
				$("#wikeyprimary"+msg.num).val(msg.data.key);
			} else {
				$("#wikey"+msg.num).val(msg.data.key);
			}
			$("#wikeysecondary"+msg.num).val(msg.data.keysecondary);
			$("#wientry"+msg.num).val(msg.data.content);
			$("#wicomment"+msg.num).val(msg.data.comment);
			adjustWiCommentHeight($("#wicomment"+msg.num)[0]);
		} else if(msg.cmd == "wifolderupdate") {
			$("#wifoldername"+msg.uid).val(msg.data.name);
			adjustWiFolderNameHeight($("#wifoldername"+msg.uid)[0]);
		} else if(msg.cmd == "wiexpand") {
			expandWiLine(msg.data);
		} else if(msg.cmd == "wiexpandfolder") {
			expandWiFolderLine(msg.data);
		} else if(msg.cmd == "wifoldercollapsecontent") {
			collapseWiFolderContent(msg.data);
		} else if(msg.cmd == "wifolderexpandcontent") {
			expandWiFolderContent(msg.data);
		} else if(msg.cmd == "wiselon") {
			enableWiSelective(msg.data);
		} else if(msg.cmd == "wiseloff") {
			disableWiSelective(msg.data);
		} else if(msg.cmd == "wiconstanton") {
			enableWiConstant(msg.data);
		} else if(msg.cmd == "wiconstantoff") {
			disableWiConstant(msg.data);
		} else if(msg.cmd == "addwiitem") {
			// Add WI entry to WI Menu
			addWiLine(msg.data);
		} else if(msg.cmd == "addwifolder") {
			addWiFolder(msg.uid, msg.data);
		} else if(msg.cmd == "wistart") {
			// Save scroll position for later so we can restore it later
			wiscroll = $("#gamescreen").scrollTop();
			// Clear previous contents of WI list
			wi_menu.html("");
			// Save wifolders_d and wifolders_l
			wifolders_d = msg.wifolders_d;
			wifolders_l = msg.wifolders_l;
		} else if(msg.cmd == "wifinish") {
			// Allow drag-and-drop rearranging of world info entries (via JQuery UI's "sortable widget")
			$("#gamescreen").sortable({
				items: "#wimenu .wisortable-body > :not(.wisortable-excluded):not(.wisortable-excluded-dynamic), #wimenu .wisortable-container[folder-uid]:not(.wisortable-excluded):not(.wisortable-excluded-dynamic)",
				containment: "#wimenu",
				connectWith: "#wimenu .wisortable-body",
				handle: ".wihandle",
				start: sortableOnStart,
				stop: sortableOnStop,
				placeholder: "wisortable-placeholder",
				delay: 2,
				cursor: "move",
				tolerance: "pointer",
				opacity: 0.21,
				revert: 173,
				scrollSensitivity: 64,
				scrollSpeed: 10,
			});
			// Restore previously-saved scroll position
			$("#gamescreen").scrollTop(wiscroll);
	 	} else if(msg.cmd == "requestwiitem") {
			// Package WI contents and send back to server
			returnWiList(msg.data);
		} else if(msg.cmd == "saveas") {
			// Show Save As prompt
			showSaveAsPopup();
		} else if(msg.cmd == "gamesaved") {
			setGameSaved(msg.data);
		} else if(msg.cmd == "hidesaveas") {
			// Hide Save As prompt
			hideSaveAsPopup();
		} else if(msg.cmd == "buildload") {
			// Send array of save files to load UI
			buildLoadList(msg.data);
		} else if(msg.cmd == "buildsp") {
			buildSPList(msg.data);
		} else if(msg.cmd == "buildus") {
			buildUSList(msg.data.unloaded, msg.data.loaded);
		} else if(msg.cmd == "askforoverwrite") {
			// Show overwrite warning
			show([$(".saveasoverwrite")]);
		} else if(msg.cmd == "popuperror") {
			// Show error in the current dialog box
			$(".popuperror").text(msg.data);
			show([$(".popuperror")]);
		} else if(msg.cmd == "genseqs") {
			// Parse generator sequences to UI
			parsegenseqs(msg.data);
		} else if(msg.cmd == "hidegenseqs") {
			// Collapse genseqs menu
			hidegenseqs();
		} else if(msg.cmd == "setchatname") {
			chat_name.val(msg.data);
		} else if(msg.cmd == "setlabelnumseq") {
			// Update setting label with value from server
			$("#setnumseqcur").html(msg.data);
		} else if(msg.cmd == "updatenumseq") {
			// Send current max tokens value to input
			$("#setnumseq").val(parseInt(msg.data));
			$("#setnumseqcur").html(msg.data);
		} else if(msg.cmd == "setlabelwidepth") {
			// Update setting label with value from server
			$("#setwidepthcur").html(msg.data);
		} else if(msg.cmd == "updatewidepth") {
			// Send current max tokens value to input
			$("#setwidepth").val(parseInt(msg.data));
			$("#setwidepthcur").html(msg.data);
		} else if(msg.cmd == "updateuseprompt") {
			// Update toggle state
			$("#setuseprompt").prop('checked', msg.data).change();
		} else if(msg.cmd == "updateadventure") {
			// Update toggle state
			$("#setadventure").prop('checked', msg.data).change();
			// Update adventure state
			setadventure(msg.data);
		} else if(msg.cmd == "updatechatmode") {
			// Update toggle state
			$("#setchatmode").prop('checked', msg.data).change();
			// Update chatmode state
			setchatmode(msg.data);
		} else if(msg.cmd == "updatedynamicscan") {
			// Update toggle state
			$("#setdynamicscan").prop('checked', msg.data).change();
		} else if(msg.cmd == "updatenopromptgen") {
			// Update toggle state
			$("#setnopromptgen").prop('checked', msg.data).change();
		} else if(msg.cmd == "updaterngpersist") {
			// Update toggle state
			$("#setrngpersist").prop('checked', msg.data).change();
			if(!$("#setrngpersist").prop("checked")) {
				$("#rngmemory").val("");
			}
		} else if(msg.cmd == "updatenogenmod") {
			// Update toggle state
			$("#setnogenmod").prop('checked', msg.data).change();
		} else if(msg.cmd == "runs_remotely") {
			remote = true;
			hide([button_savetofile, button_import, button_importwi]);
		} else if(msg.cmd == "debug_info") {
			$("#debuginfo").val(msg.data);
		} else if(msg.cmd == "set_debug") {
			if(msg.data) {
				debug_area.removeClass("hidden");
			} else {
				debug_area.addClass("hidden");
			}
		}
	});
	
	socket.on('disconnect', function() {
		connected = false;
		$("body").removeClass("connected");
		connect_status.html("<b>Lost connection...</b>");
		connect_status.removeClass("color_green");
		connect_status.addClass("color_orange");
		updateUSStatItems([], false);
		updateSPStatItems({});
	});

	// Register editing events
	game_text.on('textInput',
		chunkOnTextInput
	).on('beforeinput',
		chunkOnBeforeInput
	).on('keydown',
		chunkOnKeyDown
	).on('paste', 
		chunkOnPaste
	).on('click',
		chunkOnSelectionChange
	).on('keydown',
		chunkOnKeyDownSelectionChange
	).on('focusout',
		chunkOnFocusOut
	);
	mutation_observer = new MutationObserver(chunkOnDOMMutate);

	// This is required for the editor to work correctly in Firefox on desktop
	// because the gods of HTML and JavaScript say so
	$(document.body).on('focusin', function(event) {
		setTimeout(function() {
			if(document.activeElement !== game_text[0] && game_text[0].contains(document.activeElement)) {
				game_text[0].focus();
			}
		}, 2);
	});

	// Make the userscripts menu sortable
	var us_sortable_settings = {
		placeholder: "ussortable-placeholder",
		delay: 2,
		cursor: "move",
		tolerance: "pointer",
		opacity: 0.21,
		revert: 173,
		scrollSensitivity: 64,
		scrollSpeed: 10,
	}
	$(usunloaded).sortable($.extend({
		connectWith: "#uslistloaded",
	}, us_sortable_settings));
	$(usloaded).sortable($.extend({
		connectWith: "#uslistunloaded",
	}, us_sortable_settings));

	// Bind actions to UI buttons
	button_send.on("click", function(ev) {
		dosubmit();
	});

	button_mode.on("click", function(ev) {
		changemode();
	});
	
	button_actretry.on("click", function(ev) {
		hideMessage();
		socket.send({'cmd': 'retry', 'chatname': chatmode ? chat_name.val() : undefined, 'data': ''});
		hidegenseqs();
	});
	
	button_actback.on("click", function(ev) {
		hideMessage();
		socket.send({'cmd': 'back', 'data': ''});
		hidegenseqs();
	});
	
	button_actfwd.on("click", function(ev) {
		hideMessage();
		//hidegenseqs();
		socket.send({'cmd': 'redo', 'data': ''});
	});
	
	button_actmem.on("click", function(ev) {
		socket.send({'cmd': 'memory', 'data': ''});
	});
	
	button_savetofile.on("click", function(ev) {
		socket.send({'cmd': 'savetofile', 'data': ''});
	});
	
	button_loadfrfile.on("click", function(ev) {
		if(remote) {
			$("#remote-save-select").click();
		} else {
			socket.send({'cmd': 'loadfromfile', 'data': ''});
		}
	});

	$("#remote-save-select").on("change", function() {
		var reader = new FileReader();
		var file = $("#remote-save-select")[0].files[0];
		reader.addEventListener("load", function(response) {
			socket.send({'cmd': 'loadfromstring', 'filename': file.name, 'data': response.target.result});
		}, false);
		reader.readAsText(file);
	});
	
	button_import.on("click", function(ev) {
		socket.send({'cmd': 'import', 'data': ''});
	});
	
	button_importwi.on("click", function(ev) {
		socket.send({'cmd': 'importwi', 'data': ''});
	});
	
	button_settings.on("click", function(ev) {
		$('#settingsmenu').slideToggle("slow");
	});
	
	button_format.on("click", function(ev) {
		$('#formatmenu').slideToggle("slow");
	});
	
	popup_close.on("click", function(ev) {
		socket.send({'cmd': 'importcancel', 'data': ''});
	});
	
	popup_accept.on("click", function(ev) {
		socket.send({'cmd': 'importaccept', 'data': ''});
	});
	
	button_actwi.on("click", function(ev) {
		socket.send({'cmd': 'wi', 'data': ''});
	});
	
	button_impaidg.on("click", function(ev) {
		if(connected) {
			showAidgPopup();
		}
	});
	
	aidg_close.on("click", function(ev) {
		hideAidgPopup();
	});
	
	aidg_accept.on("click", function(ev) {
		sendAidgImportRequest();
	});
	
	button_save.on("click", function(ev) {
		socket.send({'cmd': 'saverequest', 'data': ''});
	});
	
	button_saveas.on("click", function(ev) {
		if(connected) {
			showSaveAsPopup();
		}
	});
	
	saveas_close.on("click", function(ev) {
		hideSaveAsPopup();
		socket.send({'cmd': 'clearoverwrite', 'data': ''});
	});
	
	saveas_accept.on("click", function(ev) {
		sendSaveAsRequest();
	});

	button_download.on("click", function(ev) {
		downloadStory('json');
	});

	button_downloadtxt.on("click", function(ev) {
		if(connected) {
			downloadStory('plaintext');
		}
	});
	
	button_load.on("click", function(ev) {
		socket.send({'cmd': 'loadlistrequest', 'data': ''});
	});

	button_softprompt.on("click", function(ev) {
		socket.send({'cmd': 'splistrequest', 'data': ''});
	});

	button_userscripts.on("click", function(ev) {
		socket.send({'cmd': 'uslistrequest', 'data': ''});
	});
	
	load_close.on("click", function(ev) {
		hideLoadPopup();
	});
	
	load_accept.on("click", function(ev) {
		hideMessage();
		newly_loaded = true;
		socket.send({'cmd': 'loadrequest', 'data': ''});
		hideLoadPopup();
	});

	sp_close.on("click", function(ev) {
		hideSPPopup();
	});
	
	sp_accept.on("click", function(ev) {
		hideMessage();
		socket.send({'cmd': 'sprequest', 'data': ''});
		hideSPPopup();
	});

	us_close.on("click", function(ev) {
		socket.send({'cmd': 'usloaded', 'data': usloaded.find(".uslistitem").map(function() { return $(this).attr("name"); }).toArray()});
		hideUSPopup();
	});
	
	us_accept.on("click", function(ev) {
		hideMessage();
		socket.send({'cmd': 'usloaded', 'data': usloaded.find(".uslistitem").map(function() { return $(this).attr("name"); }).toArray()});
		socket.send({'cmd': 'usload', 'data': ''});
		hideUSPopup();
	});
	
	button_newgame.on("click", function(ev) {
		if(connected) {
			showNewStoryPopup();
		}
	});
	
	ns_accept.on("click", function(ev) {
		hideMessage();
		socket.send({'cmd': 'newgame', 'data': ''});
		hideNewStoryPopup();
	});
	
	ns_close.on("click", function(ev) {
		hideNewStoryPopup();
	});

	$("#btn_dsclose").on("click", function () {
		$("#loadcontainerdelete").removeClass("flex").addClass("hidden");
		hide([$(".saveasoverwrite"), $(".popuperror")]);
	});
	
	$("#newsavename").on("input", function (ev) {
		if($(this).val() == "") {
			disableButtons([$("#btn_rensaccept")]);
		} else {
			enableButtons([$("#btn_rensaccept")]);
		}
		hide([$(".saveasoverwrite"), $(".popuperror")]);
	});
	
	$("#btn_rensclose").on("click", function () {
		$("#loadcontainerrename").removeClass("flex").addClass("hidden");
		hide([$(".saveasoverwrite"), $(".popuperror")]);
	});
	
	button_rndgame.on("click", function(ev) {
		if(connected) {
			showRandomStoryPopup();
		}
	});
	
	rs_accept.on("click", function(ev) {
		hideMessage();
		socket.send({'cmd': 'rndgame', 'memory': $("#rngmemory").val(), 'data': topic.val()});
		hideRandomStoryPopup();
	});
	
	rs_close.on("click", function(ev) {
		hideRandomStoryPopup();
	});
	
	anote_slider.on("input", function () {
		socket.send({'cmd': 'anotedepth', 'data': $(this).val()});
	});

	// Dynamically change vertical size of world info "Comment" text box
	wi_menu.on("input", ".wicomment > textarea", function () {
		adjustWiCommentHeight(this);
	});

	// Dynamically change vertical size of world info folder name text box
	wi_menu.on("input", ".wifoldername > div > textarea", function () {
		adjustWiFolderNameHeight(this);
	});

	saveasinput.on("input", function () {
		if(saveasinput.val() == "") {
			disableButtons([saveas_accept]);
		} else {
			enableButtons([saveas_accept]);
		}
		hide([$(".saveasoverwrite"), $(".popuperror")]);
	});
	
	// Bind Enter button to submit
	input_text.keydown(function (ev) {
		if (ev.which == 13 && !shift_down) {
			do_clear_ent = true;
			dosubmit(true);
		} else if(ev.which == 16) {
			shift_down = true;
		}
	});
	
	// Enter to submit, but not if holding shift
	input_text.keyup(function (ev) {
		if (ev.which == 13 && do_clear_ent) {
			input_text.val("");
			do_clear_ent = false;
		} else if(ev.which == 16) {
			shift_down = false;
		}
	});
	
	aidgpromptnum.keydown(function (ev) {
		if (ev.which == 13) {
			sendAidgImportRequest();
		}
	});
	
	saveasinput.keydown(function (ev) {
		if (ev.which == 13 && saveasinput.val() != "") {
			sendSaveAsRequest();
		}
	});

	$([input_text, anote_input, $("#gamescreen")]).map($.fn.toArray).on("input", function() {
		setGameSaved(false);
	});

	$(window).on("beforeunload", function() {
		if(!gamesaved) {
			return true;
		}
	});
});
