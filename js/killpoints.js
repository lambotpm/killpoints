route.start(true);

route('/', function() {
  riot.mount('#character-selection', 'character-selection');
});
route(function(region, realm, character) {
  var decodedRealm = decodeURIComponent(realm).replace(/\+/g, ' ');
  var decodedCharacter = decodeURIComponent(character);

  riot.mount('#character-selection', 'character-selection', { 'region': region, 'realm': decodedRealm, 'character': decodedCharacter });

  calculate(region, decodedRealm, decodedCharacter, function(data) {
    riot.mount('#killpoints', 'killpoints', data);
  })
});

function calculate(region, realm, character, callback) {
  riot.mount('#killpoints', 'loading');

  var url = 'https://' + encodeURIComponent(region) + '.api.battle.net/wow/character/' + encodeURIComponent(realm) + '/' + encodeURIComponent(character) + '?fields=progression,achievements&apikey=' + API_KEY;

  fetch(url, {
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  }).then(function(response) {
    if (response.ok) {
      return response.json();
    } else {
      throw Error(response.statusText);
    }
  }).then(function(json) {
    callback({
      'name': json.name,
      'killpoints': getKillpoints(json),
      'weeklyPoints': getWeeklyPoints(json)
    });
  }).catch(function(error) {
    riot.mount('#killpoints', 'error', { message: error });
  });
}

function getKillpoints(json) {
  return Math.round(getDailyKillpoints(json.achievements) +
                    getWeeklyChestKillpoints(json.achievements) +
                    getMythicPlusKillpoints(json.achievements) +
                    getRaidKillpoints(json.progression.raids));
}

function getWeeklyPoints(json) {
  var weeklyPoints = 0;

  if(getDailyKillpoints(json.achievements) > 0) {
    weeklyPoints += 7 * FACTORS.emissary;
  }

  if(getWeeklyChestKillpoints(json.achievements) > 0) {
    weeklyPoints += FACTORS.mPlusChest;
  }

  var mPlusPoints = getMythicPlusKillpoints(json.achievements);
  if(mPlusPoints > 0) {
    weeklyPoints += mPlusPoints / weeklyChests;
  }

  weeklyPoints += weeklyRaidKillFactor;

  return Math.round(weeklyPoints);
}

function getDailyKillpoints(achievements) {
  var killpoints = 0;

  var index = achievements.achievementsCompleted.indexOf(10671);

  if (index >= 0) {
    var days110 = moment(new Date()).diff(achievements.achievementsCompletedTimestamp[index], 'days');

    killpoints += days110 * FACTORS.emissary;
  }

  return killpoints;
}

function getWeeklyChestKillpoints(achievements) {
  var killpoints = 0;

  var index = achievements.achievementsCompleted.indexOf(10671);

  if (index >= 0) {
    weeklyChests = moment().diff(moment.max(CHEST_AVAILABLE, moment(achievements.achievementsCompletedTimestamp[index])), 'weeks');

    killpoints += weeklyChests * FACTORS.mPlusChest;
  }

  return killpoints;
}

function getMythicPlusKillpoints(achievements) {
  var killpoints = 0;

  KEYSTONES.forEach(function(keystone) {
    var index = achievements.criteria.indexOf(keystone);

    killpoints += (index < 0) ? 0 : achievements.criteriaQuantity[index] * FACTORS.mPlus;
  });

  return killpoints;
}

function getRaidKillpoints(raids) {
  var killpoints = 0;

  raids.forEach(function(raid) {
    if (RAIDS.hasOwnProperty(raid.id)) {
      raid.bosses.forEach(function(boss) {
        killpoints += boss.lfrKills * FACTORS.lfrKills;
        killpoints += boss.normalKills * FACTORS.normalKills;
        killpoints += boss.heroicKills * FACTORS.heroicKills;
        killpoints += boss.mythicKills * FACTORS.mythicKills;
      });
    }
  });

  weeklyRaidKillFactor = killpoints/weeklyChests;

  return killpoints;
}

var weeklyChests = 0;
var weeklyRaidKillFactor = 0;

const API_KEY = api_key;

const CHEST_AVAILABLE = moment('2016-09-21');

const KEYSTONES = [
  33096, // Initiate
  33097, // Challenger
  33098, // Conqueror
  32028  // Master
];

const RAIDS = {
  8440: 'Trial of Valor',
  8025: 'Nighthold',
  8026: 'Emerald Nightmare'
};

const FACTORS = {
  emissary: 2,
  mPlusChest: 11,
  mPlus: 3.5,
  lfrKills: 2,
  normalKills: 3,
  heroicKills: 4,
  mythicKills: 6
};
