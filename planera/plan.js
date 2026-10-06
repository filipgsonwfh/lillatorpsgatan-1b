/* Ritningen för Lillatorpsgatan 1B.
 *
 * Alla mått är innermått i cm. Origo är vardagsrummets övre vänstra hörn.
 * Ändra här om måtten visar sig vara fel när du mätt på plats.
 * Höj `version` när väggar, öppningar eller fast inredning ändras, så får
 * sparade versioner frågan om de vill hämta den nya ritningen.
 */
const PLAN = {
  DEFAULTS: {
    version: 3,
    wall: 14,
    snap: 5,
    rooms: [
      {id:'vard',   name:'Vardagsrum', x:0,    y:0,   w:455, h:417, kind:'rum'},
      {id:'sov',    name:'Sovrum',     x:479,  y:0,   w:536, h:252, kind:'rum', group:'sov'},
      {id:'sov2',   name:'',           x:479,  y:252, w:109, h:88,  kind:'rum', group:'sov'},
      {id:'hall1a', name:'',           x:598,  y:266, w:176, h:193, kind:'hall', group:'hall1'},
      {id:'hall1b', name:'Hall',       x:479,  y:357, w:295, h:102, kind:'hall', group:'hall1'},
      {id:'bad',    name:'Badrum',     x:788,  y:266, w:227, h:193, kind:'vat'},
      {id:'kok',    name:'Kök',        x:612,  y:473, w:403, h:402, kind:'rum'},
      {id:'hall2',  name:'Hall',       x:353,  y:435, w:245, h:238, kind:'hall'},
      {id:'barn',   name:'Barnrum',    x:0,    y:435, w:336, h:238, kind:'rum'},
      {id:'kont',   name:'Kontor',     x:-67,  y:693, w:351, h:277, kind:'rum'},
      {id:'pass',   name:'',           x:298,  y:693, w:168, h:126, kind:'hall', group:'pass'},
      {id:'passc',  name:'',           x:466,  y:721, w:13,  h:78,  kind:'hall', group:'pass'},
      {id:'wc',     name:'Badrum',     x:298,  y:833, w:161, h:144, kind:'vat'},
      {id:'entre',  name:'Entré',      x:479,  y:673, w:119, h:202, kind:'hall', group:'entre'},
      {id:'entre2', name:'',           x:501,  y:875, w:87,  h:123, kind:'hall', group:'entre'},
      {id:'balk',   name:'Balkong',    x:-135, y:326, w:121, h:339, kind:'balkong'}
    ],
    walls: [
      {id:'k1', x:455, y:417, w:24, h:74},
      {id:'k2', x:459, y:875, w:42, h:123}
    ],
    openings: [
      {id:'o1', type:'door',    x:-14,  y:322, len:92,  dir:'v', thick:14, hinge:0, flip:false, note:'Balkongdörr'},
      {id:'o2', type:'opening', x:353,  y:417, len:102, dir:'h', thick:18, hinge:0, flip:false, note:'Vardagsrum–hall'},
      {id:'o3', type:'door',    x:511,  y:340, len:77,  dir:'h', thick:17, hinge:0, flip:true,  note:'Sovrum (slår in i nischen)'},
      {id:'o4', type:'door',    x:774,  y:378, len:58,  dir:'v', thick:14, hinge:0, flip:true,  note:'Badrum'},
      {id:'o5', type:'opening', x:598,  y:536, len:98,  dir:'v', thick:14, hinge:0, flip:false, note:'Kök'},
      {id:'o6', type:'door',    x:336,  y:526, len:76,  dir:'v', thick:17, hinge:0, flip:true,  note:'Barnrum'},
      {id:'o7', type:'door',    x:284,  y:753, len:77,  dir:'v', thick:14, hinge:0, flip:false, note:'Kontor'},
      {id:'o8', type:'door',    x:382,  y:819, len:55,  dir:'h', thick:14, hinge:0, flip:true,  note:'Lilla badrummet'},
      {id:'o9', type:'door',    x:504,  y:998, len:81,  dir:'h', thick:14, hinge:1, flip:true,  note:'Ytterdörr'},
      {id:'w1', type:'window',  x:-14,  y:74,  len:231, dir:'v', thick:14, hinge:0, flip:false, note:'Vardagsrum'},
      {id:'w2', type:'window',  x:-14,  y:487, len:126, dir:'v', thick:14, hinge:0, flip:false, note:'Barnrum'},
      {id:'w3', type:'window',  x:-81,  y:735, len:123, dir:'v', thick:14, hinge:0, flip:false, note:'Kontor'},
      {id:'w4', type:'window',  x:1015, y:63,  len:126, dir:'v', thick:14, hinge:0, flip:false, note:'Sovrum'},
      {id:'w5', type:'window',  x:1015, y:333, len:98,  dir:'v', thick:14, hinge:0, flip:false, note:'Badrum'},
      {id:'w6', type:'window',  x:1015, y:627, len:126, dir:'v', thick:14, hinge:0, flip:false, note:'Kök'}
    ],
    furniture: [
      {id:'fx-os',  name:'Öppen spis', x:345, y:0,   w:110, h:110, cat:'ovrigt', fixed:true, shape:'quarter'},
      {id:'fx-g1',  name:'G', x:479, y:4,   w:60, h:60, cat:'tra', fixed:true},
      {id:'fx-g2',  name:'G', x:479, y:65,  w:60, h:60, cat:'tra', fixed:true},
      {id:'fx-g3',  name:'G', x:479, y:126, w:60, h:60, cat:'tra', fixed:true},
      {id:'fx-g4',  name:'G', x:598, y:274, w:58, h:83, cat:'tra', fixed:true},
      {id:'fx-g5',  name:'G', x:656, y:274, w:59, h:83, cat:'tra', fixed:true},
      {id:'fx-g6',  name:'G', x:715, y:274, w:59, h:83, cat:'tra', fixed:true},
      {id:'fx-tm',  name:'TM', x:790, y:268, w:52, h:52, cat:'vit', fixed:true},
      {id:'fx-bk',  name:'Badkar', x:940, y:268, w:70, h:170, cat:'vat', fixed:true},
      {id:'fx-wc1', name:'WC', x:878, y:397, w:40, h:60, cat:'vat', fixed:true},
      {id:'fx-hf1', name:'Handfat', x:798, y:415, w:60, h:44, cat:'vat', fixed:true},
      {id:'fx-kb',  name:'Bänk', x:612, y:473, w:392, h:60, cat:'tra', fixed:true},
      {id:'fx-dm',  name:'DM', x:652, y:473, w:60, h:60, cat:'vit', fixed:true},
      {id:'fx-dh',  name:'Diskho', x:778, y:473, w:60, h:60, cat:'vit', fixed:true},
      {id:'fx-sp',  name:'Häll', x:920, y:473, w:60, h:60, cat:'vit', fixed:true},
      {id:'fx-f',   name:'F', x:612, y:641, w:63, h:91, cat:'vit', fixed:true},
      {id:'fx-k',   name:'K', x:612, y:732, w:63, h:91, cat:'vit', fixed:true},
      {id:'fx-sk',  name:'SK', x:686, y:819, w:63, h:56, cat:'tra', fixed:true},
      {id:'fx-g7',  name:'G', x:-67, y:912, w:51, h:58, cat:'tra', fixed:true},
      {id:'fx-g8',  name:'G', x:-16, y:912, w:51, h:58, cat:'tra', fixed:true},
      {id:'fx-g9',  name:'G', x:35,  y:912, w:51, h:58, cat:'tra', fixed:true},
      {id:'fx-g10', name:'G', x:86,  y:912, w:51, h:58, cat:'tra', fixed:true},
      {id:'fx-wc2', name:'WC', x:376, y:917, w:40, h:58, cat:'vat', fixed:true},
      {id:'fx-hf2', name:'Handfat', x:415, y:861, w:44, h:74, cat:'vat', fixed:true},
      {id:'fx-du',  name:'Dusch', x:298, y:880, w:72, h:90, cat:'vat', fixed:true},
      {id:'fx-hh',  name:'Hatthylla', x:298, y:693, w:161, h:28, cat:'tra', fixed:true}
    ]
  },

  NOTES: [
    'Ritningen följer mäklarens planritning, dörr för dörr. Skalan är 1,4 cm per bildpunkt så att vardagsrummets djup (421) och hela bredden (545 + 460) stämmer med de mått vi hade.',
    'Måtten 545 och 460 verkar ha hamnat på fel rum i skissen: enligt planritningen är vardagsrummet ca 455 brett och sovrummet ca 535. Värt att kolla med tumstock.',
    'Barnrummet blir ca 335 × 240 och kontoret ca 350 × 277 enligt planritningen. Skissen sa 410 respektive 440 i bredd.',
    'Köket är ca 400 × 400 enligt planritningen, alltså större än skissens 300.',
    'Duschen i lilla badrummet finns inte med på planritningen, den är placerad utifrån fotot.',
    'Väggarna ritas 14 cm tjocka om inte annat anges. Ytterväggarna är tjockare i verkligheten, men det påverkar inte innermåtten.'
  ],

  CATALOG: [
    ['Soffa 3-sits',220,90,'textil'],['Soffa 2-sits',170,90,'textil'],['Hörnsoffa',260,160,'textil'],['Fåtölj',80,85,'textil'],
    ['Soffbord',110,60,'tra'],['TV-bänk',180,40,'tra'],['Bokhylla 80',80,30,'tra'],['Matbord 6 pers',180,90,'tra'],['Matbord 4 pers',120,80,'tra'],['Stol',45,45,'tra'],
    ['Dubbelsäng 160',160,200,'textil'],['Dubbelsäng 180',180,200,'textil'],['Enkelsäng 90',90,200,'textil'],['Spjälsäng',60,120,'textil'],['Juniorsäng',70,160,'textil'],['Sängbord',45,40,'tra'],
    ['Garderob 100',100,60,'tra'],['Byrå',100,50,'tra'],['Skrivbord',140,70,'tra'],['Kontorsstol',60,60,'textil'],
    ['Kyl/frys',60,65,'vit'],['Spis',60,60,'vit'],['Diskmaskin',60,60,'vit'],['Tvättmaskin',60,60,'vit'],['Köksbänk 100',100,60,'tra'],
    ['Badkar',160,70,'vat'],['Dusch',90,90,'vat'],['Toalett',40,65,'vat'],['Handfat',50,40,'vat'],
    ['Matta 200×300',200,300,'matta'],['Piano',150,60,'tra'],['Barnvagn',60,100,'ovrigt']
  ],

  KINDS: {rum:'Rum', hall:'Hall', vat:'Våtrum', skap:'Skåp/schakt', balkong:'Balkong'},
  CATS: {textil:'Textil', tra:'Trä', vit:'Vitvara', vat:'Sanitet', matta:'Matta', ovrigt:'Övrigt'}
};
