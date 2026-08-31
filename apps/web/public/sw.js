self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text?.()||''}}
  const title=data.title||'FaisLaJob';
  const options={
    body:data.body||'Tu as une nouvelle mise à jour.',
    icon:data.icon||'/faislajob-logo.png',
    badge:data.badge||'/faislajob-logo.png',
    tag:data.tag||'faislajob',
    renotify:true,
    data:{url:data.url||'/'},
    vibrate:[120,60,120]
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification?.data?.url||'/';
  event.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if('focus'in client){await client.focus();if('navigate'in client)await client.navigate(url);return;}
    }
    if(clients.openWindow)await clients.openWindow(url);
  })());
});
