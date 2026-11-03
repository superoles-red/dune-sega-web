// Descriptors come from the original native guards; this selects UI only.
export function contextAction(actions={}){
 if(actions.placementActive)return null;
 if(actions.bAvailable){const kind=actions.bKind||'confirm-native';return {method:'b',kind,label:({repeat:'REPEAT','confirm-devastator':'DETONATE','confirm-mcv':'DEPLOY','confirm-native':'CONFIRM'}[kind]||'ACTION'),aria:({repeat:'Повторить производство','confirm-devastator':'Завершить отсчёт самоподрыва — оригинальная B','confirm-mcv':'Подтвердить развёртывание — оригинальная B','confirm-native':'Завершить особый отсчёт — оригинальная B'}[kind]||'Действие оригинальной кнопки B')};}
 if(actions.selfAvailable){const mcv=actions.selfKind==='mcv';return {method:'self',kind:'self-'+actions.selfKind,label:mcv?'DEPLOY':'ARM',aria:mcv?'Начать развёртывание — оригинальное нажатие на сам юнит':'Включить отсчёт самоподрыва — оригинальное нажатие на сам юнит'};}
 return null;
}
