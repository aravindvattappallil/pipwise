export const instruments = [
  {symbol:'EUR/USD',name:'Euro / US dollar',contract:100000,pip:.0001,entry:1.1,stop:1.098,target:1.104,quote:'USD'},
  {symbol:'GBP/USD',name:'British pound / US dollar',contract:100000,pip:.0001,entry:1.27,stop:1.267,target:1.276,quote:'USD'},
  {symbol:'USD/JPY',name:'US dollar / Japanese yen',contract:100000,pip:.01,entry:150,stop:149.5,target:151,quote:'JPY'},
  {symbol:'XAU/USD',name:'Gold / US dollar',contract:100,pip:.01,entry:2600,stop:2590,target:2620,quote:'USD'},
  {symbol:'BTC/USD',name:'Bitcoin / US dollar',contract:1,pip:1,entry:90000,stop:89000,target:92000,quote:'USD'},
  {symbol:'NAS100',name:'Nasdaq 100 CFD',contract:1,pip:1,entry:20000,stop:19900,target:20200,quote:'USD'},
];
export type RiskInput={balance:number;risk:number;mode:'percent'|'cash';direction:'long'|'short';entry:number;stop:number;target:number|null;contract:number;pip:number;step:number;usdPerCurrency:number;quote:string;};
export function calculateRisk(i:RiskInput){
  const numbers=[i.balance,i.risk,i.entry,i.stop,i.contract,i.pip,i.step,i.usdPerCurrency];
  if(numbers.some(n=>!Number.isFinite(n)||n<=0))return {error:'Enter positive values for your balance, risk, prices and contract settings.'} as const;
  if(i.target!==null && (!Number.isFinite(i.target)||i.target<=0))return {error:'Enter a positive take-profit price or leave it empty.'} as const;
  const distance=i.direction==='long'?i.entry-i.stop:i.stop-i.entry;
  if(distance<=0)return {error:i.direction==='long'?'For a buy trade, stop loss must be below entry.':'For a sell trade, stop loss must be above entry.'} as const;
  const reward=i.target===null?null:i.direction==='long'?i.target-i.entry:i.entry-i.target;
  if(reward!==null && reward<=0)return {error:i.direction==='long'?'Take profit must be above entry for a buy trade.':'Take profit must be below entry for a sell trade.'} as const;
  const budget=i.mode==='percent'?i.balance*i.risk/100:i.risk;
  if(budget>i.balance)return {error:'Risk budget cannot exceed your account balance.'} as const;
  // USD/JPY losses convert at the stop; profits at the target.
  const stopConversion=i.quote==='JPY'?1/i.stop:1;
  const targetConversion=i.quote==='JPY'?1/(i.target||i.entry):1;
  const lossPerLot=distance*i.contract*stopConversion/i.usdPerCurrency;
  const lots=Math.floor((budget/lossPerLot+1e-10)/i.step)*i.step;
  const actualRisk=lots*lossPerLot;
  const profit=reward===null?null:lots*reward*i.contract*targetConversion/i.usdPerCurrency;
  return {error:null,lots:Number(lots.toFixed(8)),units:lots*i.contract,budget,actualRisk,profit,pips:distance/i.pip,pipValue:lots*i.contract*i.pip*stopConversion/i.usdPerCurrency,ratio:profit===null||actualRisk===0?null:profit/actualRisk};
}
