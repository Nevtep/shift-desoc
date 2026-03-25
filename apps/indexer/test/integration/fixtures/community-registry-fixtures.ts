import { emitterMappingActive, emitterMappingWindows, unmappedEmitterAlerts } from "../../../ponder.schema";

type TableKey = "windows" | "active" | "alerts";

const tableMap = new Map<any, TableKey>([
  [emitterMappingWindows, "windows"],
  [emitterMappingActive, "active"],
  [unmappedEmitterAlerts, "alerts"],
]);

const keyForTable = (table: any): TableKey => {
  const key = tableMap.get(table);
  if (!key) throw new Error("Unsupported table in fake db");
  return key;
};

const primaryKeyByTable: Record<TableKey, string> = {
  windows: "id",
  active: "emitterAddress",
  alerts: "id",
};

export const createFakeIndexerDb = () => {
  const state: Record<TableKey, any[]> = {
    windows: [],
    active: [],
    alerts: [],
  };

  const db: any = {
    __state: state,
    __getEmitterWindows: (emitterAddress: string) =>
      state.windows.filter((row) => row.emitterAddress === emitterAddress.toLowerCase()),
    sql: {
      update(table: any) {
        const key = keyForTable(table);
        return {
          set(update: any) {
            return {
              where(expr: any) {
                const columnName = expr?.left?.name;
                const value = expr?.right?.value;
                if (!columnName) return;

                state[key] = state[key].map((row) => {
                  const pass = row[columnName] === value;
                  return pass ? { ...row, ...update } : row;
                });
              },
            };
          },
        };
      },
    },
    insert(table: any) {
      const key = keyForTable(table);
      return {
        values(row: any) {
          return {
            onConflictDoNothing() {
              const pk = primaryKeyByTable[key];
              if (!state[key].some((item) => item[pk] === row[pk])) {
                state[key].push({ ...row });
              }
            },
            onConflictDoUpdate({ target, set }: { target: any; set: any }) {
              const pk = typeof target === "string" ? target : primaryKeyByTable[key];
              const idx = state[key].findIndex((item) => item[pk] === row[pk]);
              if (idx >= 0) {
                state[key][idx] = { ...state[key][idx], ...set };
              } else {
                state[key].push({ ...row });
              }
            },
          };
        },
      };
    },
    update(table: any, where: any) {
      const key = keyForTable(table);
      return {
        set(update: any) {
          state[key] = state[key].map((row) => {
            const pass = Object.entries(where).every(([k, v]) => row[k] === v);
            return pass ? { ...row, ...update } : row;
          });
        },
      };
    },
    delete(table: any) {
      const key = keyForTable(table);
      return {
        where(expr: any) {
          const columnName = expr?.left?.name;
          const value = expr?.right?.value;
          if (!columnName) return;
          state[key] = state[key].filter((row) => row[columnName] !== value);
        },
      };
    },
  };

  return db;
};

export const makeModuleUpdate = (overrides?: Partial<any>) => ({
  communityId: 1,
  moduleKey: "REQUEST_HUB",
  oldAddress: "0x0000000000000000000000000000000000000000",
  newAddress: "0x1111111111111111111111111111111111111111",
  blockNumber: 100n,
  logIndex: 1,
  txHash: "0xabc",
  timestamp: new Date("2026-03-25T00:00:00.000Z"),
  ...overrides,
});
