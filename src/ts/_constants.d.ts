// GENERATED CONSTANTS
declare const X: 0;
declare const Y: 1;
declare const Z: 2;
declare const W: 3;

declare const R: 0;
declare const G: 1;
declare const B: 2;
declare const A: 3;

declare const DX: 0;
declare const DY: 1;
declare const DIST: 2;
declare const NX: 3;
declare const NY: 4;

declare const SCREEN_WIDTH: 640;
declare const SCREEN_HEIGHT: 360;

declare const SCREEN_HALF_W: 320;
declare const SCREEN_HALF_H: 180;

declare const IMAGE_WIDTH: 256;
declare const IMAGE_HEIGHT: 16;

declare const ATLAS_WIDTH: 512;
declare const ATLAS_HEIGHT: 512;

declare const GL_TRIANGLES: 4;
declare const GL_TRIANGLES_FAN: 6;
declare const GL_SRC_ALPHA: 770;
declare const GL_ONE_MINUS_SRC_ALPHA: 771;
declare const GL_BLEND: 3042;
declare const GL_TEXTURE_2D: 3553;
declare const GL_UNSIGNED_BYTE: 5121;
declare const GL_UNSIGNED_SHORT: 5123;
declare const GL_FLOAT: 5126;
declare const GL_RGBA: 6408;
declare const GL_NEAREST: 9728;
declare const GL_TEXTURE_MAG_FILTER: 10240;
declare const GL_TEXTURE_MIN_FILTER: 10241;
declare const GL_TEXTURE_WRAP_S: 10242;
declare const GL_TEXTURE_WRAP_T: 10243;
declare const GL_COLOR_BUFFER_BIT: 16384;
declare const GL_CLAMP_TO_EDGE: 33071;
declare const GL_TEXTURE0: 33984;
declare const GL_TEXTURE1: 33985;
declare const GL_ARRAY_BUFFER: 34962;
declare const GL_ELEMENT_ARRAY_BUFFER: 34963;
declare const GL_STATIC_DRAW: 35044;
declare const GL_DYNAMIC_DRAW: 35048;
declare const GL_FRAGMENT_SHADER: 35632;
declare const GL_VERTEX_SHADER: 35633;
declare const GL_COLOR_ATTACHMENT0: 36064;
declare const GL_FRAMEBUFFER: 36160;
declare const GL_RED: 6403;
declare const GL_R32F: 33326;
declare const GL_RGB: 6407;
declare const GL_RGB32F: 34837;

declare const D_LEFT: 0;
declare const D_UP: 1;
declare const D_RIGHT: 2;
declare const D_DOWN: 3;
declare const LOOK_LEFT: 4;
declare const LOOK_RIGHT: 5;
declare const A_BUTTON: 6;
declare const B_BUTTON: 7;
declare const MAP_BUTTON: 8;

declare const KEY_IS_UP: 0;
declare const KEY_WAS_DOWN: 1;
declare const KEY_IS_DOWN: 2;

declare const TEXT_H_ALIGN_LEFT: 0;
declare const TEXT_H_ALIGN_CENTER: 1;
declare const TEXT_H_ALIGN_RIGHT: 2;

declare const TEXT_V_ALIGN_TOP: 0;
declare const TEXT_V_ALIGN_MIDDLE: 1;
declare const TEXT_V_ALIGN_BOTTOM: 2;

declare const TEXTURE_TYPE_SPRITE: 0;
declare const TEXTURE_TYPE_SPRITE_STRIP: 1;

declare const TEXTURE_UNKNOWN: 0;
declare const TEXTURE_WALL: 1;
declare const TEXTURE_FLOOR: 2;
declare const TEXTURE_CEILING: 3;
declare const TEXTURE_BAT: 4;
declare const TEXTURE_BRICK: 5;
declare const TEXTURE_BRICK_CRACK: 6;
declare const TEXTURE_STONE: 7;
declare const TEXTURE_WOOD: 8;
declare const TEXTURE_HORN: 9;
declare const TEXTURE_DEMON: 10;
declare const TEXTURE_DEMON_MEDIUM: 11;
declare const TEXTURE_DEMON_LARGE: 12;

declare const CELL_FLOOR: 0;
declare const CELL_WALL: 1;
declare const CELL_CRACKED: 2;
declare const CELL_HORIZONTAL_DOOR: 3;
declare const CELL_VERTICAL_DOOR: 4;
declare const CELL_LOCKED_H: 5;
declare const CELL_LOCKED_V: 6;
declare const CELL_BOSS_DOOR: 7;
declare const CELL_EXIT: 8;

declare const WALL_NORTH: 0;
declare const WALL_EAST: 1;
declare const WALL_SOUTH: 2;
declare const WALL_WEST: 3;

declare const WALL_MAP_BLOCKED: -3;
declare const WALL_BLOCKED: -2;
declare const WALL_FREE: -1;

declare const ROOM_TYPE_NORMAL: 0;
declare const ROOM_TYPE_PLAYER: 1;
declare const ROOM_TYPE_BOSS: 2;
declare const ROOM_TYPE_SECRET: 3;

declare const EASE_LINEAR: 0;
declare const EASE_SMOOTHSTEP: 1;

declare const EVENT_NONE: 0;
declare const EVENT_DOOR_OPEN: 1;
declare const EVENT_DOOR_CLOSE: 2;
declare const EVENT_WALL_DESTROY: 3;
declare const EVENT_WALL_FLASH: 4;
declare const EVENT_BOSS_SPAWN: 5;
declare const EVENT_BOSS_DIED: 6;
declare const EVENT_SPAWN_PARTICLES: 7;
declare const EVENT_DELAY: 8;

declare const GS_OPT_MUSIC: 0;
declare const GS_OPT_BOB: 1;
declare const GS_OPT_SHAKE: 2;
declare const GS_OPT_AIM: 3;
declare const GS_OPT_KEYMAP: 4;

declare const GS_PAUSE_GAME: 0;
declare const GS_SEED: 1;
declare const GS_OPEN_MAP: 2;
declare const GS_LIVES: 3;
declare const GS_LEVEL: 4;
declare const GS_MAX_CHARGE: 5;
declare const GS_PLAYER_HP: 6;
declare const GS_PLAYER_MAX_HP: 7;
declare const GS_PLAYER_X: 8;
declare const GS_PLAYER_Y: 9;
declare const GS_PLAYER_ANGLE: 10;
declare const GS_PLAYER_INVULNERABLE: 11;

declare const FLAG_ACTIVE: 1;
declare const FLAG_PARTICLE: 2;
declare const FLAG_DUST_MOTE: 4;
declare const FLAG_SOLID: 8;
declare const FLAG_DAMAGE: 16;
declare const FLAG_PROJECTILE: 32;
declare const FLAG_ENEMY: 64;
declare const FLAG_HEALTH_PACK: 128;

declare const ENEMY_NONE: 0;
declare const ENEMY_MELEE: 1;
declare const ENEMY_TANK: 2;
declare const ENEMY_RANGED: 3;
declare const ENEMY_BOSS_BULLET: 4;
declare const ENEMY_BOSS_BROOD: 5;
declare const ENEMY_BOSS_CHARGE: 6;

declare const MAX_ENTITIES: 5000;
declare const MAX_VISIBLE: 1000;
declare const DRIFT_SPEED: 0.15;
declare const STEER_STRENGTH: 1.25;
declare const MAX_PARTICLE_DIST: 19;
declare const MAX_PARTICLE_DIST_SQ: 361;
declare const Z_MIN: -0.10;
declare const Z_MAX: 1.35;
declare const BEAM_SPREAD: 0.12;
declare const BEAM_RANGE: 20;
declare const BEAM_STEP: 0.1;
declare const MELEE_SPEED: 1.55;
declare const TANK_SPEED: 0.95;
declare const RANGED_SPEED: 1.15;
declare const PROJECTILE_SPEED: 7;
declare const MELEE_ATTACK_RANGE: 1.15;
declare const RANGED_ATTACK_RANGE: 7.5;
declare const RANGED_MAX_DIST: 6.2;
declare const MELEE_COOLDOWN: 1.1;
declare const RANGED_COOLDOWN: 1.6;
declare const TANK_COOLDOWN: 1.4;
declare const PSEUDO_LIFETIME: 0.18;
declare const PROJECTILE_LIFETIME: 5.4;
declare const NOTICE_DELAY_MIN: 0.55;
declare const NOTICE_DELAY_MAX: 1;
declare const IDLE_WANDER_SPEED: 0.35;
declare const SEPARATION_RADIUS: 0.85;
declare const SEPARATION_STRENGTH: 2.8;
declare const BEAM_BASE_DAMAGE: 1;
declare const BEAM_HIT_RADIUS: 0.55;
declare const ENEMY_FLASH_DURATION: 0.1;
declare const PLAYER_INVULNERABLE_DURATION: 0.5;
declare const LIGHT_DECAY: 6.5;
declare const LIGHT_LEVEL_CAP: 1;

declare const RED: 0;
declare const ORANGE: 1;
declare const YELLOW: 2;
declare const GREEN: 3;
declare const BLUE: 4;
declare const INDIGO: 5;
declare const VIOLET: 6;
