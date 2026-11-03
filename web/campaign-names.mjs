// Display labels only. Original names/passwords remain unchanged in the data.
export function displayMissionName(house,mission,originalName){
 if(Number.isInteger(house)&&house>=0&&house<3&&mission===1)return 'BEGINNING';
 return typeof originalName==='string'&&originalName.length?originalName:'MISSION '+mission;
}
