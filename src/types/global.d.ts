/**
 * Global type declarations
 * 
 * This file defines global types used throughout the application
 */

declare global {
  var Currencies: {
    getData: (userID: string) => Promise<{ exp: number; money: number }>;
    setData: (userID: string, data: any) => Promise<boolean>;
    increaseMoney: (userID: string, amount: number) => Promise<boolean>;
    decreaseMoney: (userID: string, amount: number) => Promise<boolean>;
    increaseExp: (userID: string, amount: number) => Promise<boolean>;
  };
}

export {};