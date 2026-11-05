// Descriptors come from the original native guards; this selects UI only.
export function contextAction(actions={}){
 if(actions.placementActive)return null;
 if(actions.bAvailable){const kind=actions.bKind||'confirm-native';return {method:'b',kind,label:({repeat:'REPEAT','confirm-devastator':'DETONATE','confirm-mcv':'DEPLOY','confirm-native':'CONFIRM'}[kind]||'ACTION'),aria:({repeat:'Повторить производство','confirm-devastator':'Завершить отсчёт самоподрыва — оригинальная B','confirm-mcv':'Подтвердить развёртывание — оригинальная B','confirm-native':'Завершить особый отсчёт — оригинальная B'}[kind]||'Действие оригинальной кнопки B')};}
 // Arming belongs to the explicit contextual command on the selected unit.
 // The bottom row exposes only an already available original B action.
 return null;
}
