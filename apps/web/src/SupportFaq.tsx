import { useMemo, useState } from 'react';
import './support-faq.css';

type Faq={category:string;question:string;answer:string};

const faqs:Faq[]=[
 {category:'Commandes',question:'Comment faire une nouvelle demande?',answer:'Appuie sur « Nouvelle demande », choisis la catégorie qui correspond à ta job, réponds aux questions, indique le moment et l’adresse, puis vérifie le résumé avant d’envoyer. FaisLaJob cherchera ensuite un partenaire disponible.'},
 {category:'Commandes',question:'Comment savoir si un partenaire a accepté ma demande?',answer:'Le statut de ta commande se met à jour automatiquement. Quand un partenaire accepte, tu verras « Partenaire trouvé », puis les étapes En route, Arrivé et En cours selon l’avancement.'},
 {category:'Commandes',question:'Pourquoi ma demande est encore en attente?',answer:'Cela signifie qu’aucun partenaire disponible n’a encore accepté la mission. Le temps peut varier selon la catégorie, l’heure, la météo, la distance et le nombre de partenaires en ligne.'},
 {category:'Commandes',question:'Puis-je modifier une demande après l’avoir envoyée?',answer:'Si aucun partenaire n’a encore commencé la mission, communique avec le support pour demander une correction. Si la mission est déjà acceptée ou commencée, certaines modifications peuvent nécessiter l’accord du partenaire.'},
 {category:'Commandes',question:'Puis-je réserver une job pour plus tard?',answer:'Oui. Lorsque l’option est disponible dans le parcours, choisis une date ou une plage prévue. La disponibilité d’un partenaire reste toutefois à confirmer.'},
 {category:'Tarifs',question:'Comment les tarifs sont-ils calculés?',answer:'Chaque catégorie a un tarif à la minute et un tarif à l’heure. La facturation se fait selon le temps de la mission, avec un minimum facturable de 15 minutes.'},
 {category:'Tarifs',question:'Pourquoi y a-t-il un minimum de 15 minutes?',answer:'Le minimum de 15 minutes permet de couvrir les très petites interventions tout en gardant une tarification simple. Le montant minimum est affiché avant d’envoyer ta demande.'},
 {category:'Tarifs',question:'Où puis-je voir le prix avant de commander?',answer:'Le tarif à la minute, le tarif à l’heure et le minimum de 15 minutes sont affichés directement dans les catégories puis dans le résumé avant l’envoi.'},
 {category:'Tarifs',question:'Est-ce que le prix final peut être différent du minimum affiché?',answer:'Oui. Le minimum correspond à 15 minutes. Si la mission dure plus longtemps, le montant augmente selon le temps réellement facturable et les frais applicables affichés à la facturation.'},
 {category:'Paiements',question:'Quand suis-je facturé?',answer:'La facture devient disponible lorsque la mission est terminée. Tu peux consulter le détail dans « Paiements & factures ».'},
 {category:'Paiements',question:'Où trouver mes factures?',answer:'Va dans l’onglet « Paiements ». Les commandes terminées y apparaissent avec leur facture et leur statut de paiement.'},
 {category:'Paiements',question:'Que faire si un paiement ne fonctionne pas?',answer:'Réessaie après avoir vérifié ta connexion et tes informations de paiement. Si le problème continue, prends en note le numéro de commande et communique avec le support.'},
 {category:'Paiements',question:'Puis-je contester un montant?',answer:'Oui. Si le temps facturé, le service ou le montant te semble incorrect, communique avec le support en indiquant le numéro de commande et une courte explication. Le dossier pourra être vérifié.'},
 {category:'Annulations',question:'Puis-je annuler une demande?',answer:'Une demande peut être annulée tant qu’elle n’est pas terminée. Les conditions peuvent varier selon le moment de l’annulation et selon qu’un partenaire a déjà été trouvé ou s’est déplacé.'},
 {category:'Annulations',question:'Que se passe-t-il si aucun partenaire n’est trouvé?',answer:'La demande reste en attente jusqu’à ce qu’un partenaire accepte ou jusqu’à son annulation. Si personne n’est trouvé, tu peux l’annuler sans qu’une mission non effectuée soit facturée.'},
 {category:'Annulations',question:'Que faire si le partenaire ne se présente pas?',answer:'Vérifie d’abord le statut de la mission. Si le partenaire est indiqué Arrivé ou En route mais ne se présente pas, communique avec le support avec le numéro de commande afin que la situation soit vérifiée.'},
 {category:'Sécurité',question:'Comment vérifier que la bonne personne est liée à ma mission?',answer:'Utilise les informations affichées dans ton portail et le numéro de mission. Ne transmets jamais ton mot de passe. Le NIP de vérification de ton profil sert aux communications avec FaisLaJob, pas à te connecter.'},
 {category:'Sécurité',question:'Est-ce que je dois payer directement le partenaire?',answer:'Utilise seulement les méthodes de paiement prévues par FaisLaJob pour la mission. Évite les paiements non documentés qui ne correspondent pas aux instructions affichées dans ton portail.'},
 {category:'Sécurité',question:'Que faire si je ne me sens pas en sécurité?',answer:'Mets fin à l’interaction et éloigne-toi si nécessaire. En cas de danger immédiat, contacte les services d’urgence. Ensuite, signale la situation au support FaisLaJob avec le numéro de mission.'},
 {category:'Compte',question:'Comment retrouver mon identifiant client et mon NIP?',answer:'Va dans « Profil ». Ton identifiant client et ton NIP de vérification du jour y sont affichés. Le NIP change chaque jour.'},
 {category:'Compte',question:'À quoi sert mon NIP de vérification?',answer:'Il aide l’équipe FaisLaJob à confirmer ton profil lorsque tu communiques avec le support. Il ne remplace jamais ton mot de passe.'},
 {category:'Compte',question:'Comment changer mes informations personnelles?',answer:'Certaines informations apparaissent dans ton profil. Si une donnée ne peut pas encore être modifiée directement, communique avec le support pour demander la correction.'},
 {category:'Technique',question:'Pourquoi une page ne se met pas à jour?',answer:'Essaie d’actualiser la page, ferme puis rouvre le site, et vérifie ta connexion Internet. Les statuts de mission se mettent normalement à jour automatiquement.'},
 {category:'Technique',question:'Je vois une ancienne version du site. Que faire?',answer:'Ferme complètement l’onglet ou l’application Web, rouvre FaisLaJob et recharge la page. Le navigateur peut parfois conserver temporairement une ancienne version.'},
 {category:'Technique',question:'Je ne reçois pas de notification.',answer:'Vérifie que les notifications sont autorisées pour FaisLaJob dans les réglages de ton appareil et de ton navigateur. Garde aussi ton compte connecté.'},
 {category:'Partenaires',question:'Comment devenir partenaire FaisLaJob?',answer:'Crée ou utilise un compte partenaire. Une fois ton compte actif, tu peux te mettre en ligne et recevoir les jobs correspondant aux catégories disponibles.'},
 {category:'Partenaires',question:'Comment fonctionnent les partenaires?',answer:'Les partenaires sont des personnes disponibles pour effectuer les missions publiées. Lorsqu’un partenaire accepte une offre, la mission lui est assignée et son avancement est transmis au portail.'},
];

export default function SupportFaq(){
 const[query,setQuery]=useState('');const[category,setCategory]=useState('Tout');const[open,setOpen]=useState<number|null>(null);
 const categories=['Tout',...Array.from(new Set(faqs.map(f=>f.category)))];
 const filtered=useMemo(()=>faqs.filter(f=>(category==='Tout'||f.category===category)&&(`${f.question} ${f.answer}`.toLowerCase().includes(query.trim().toLowerCase()))),[query,category]);
 return <section className="support-page">
  <div className="support-hero"><span className="portal-kicker">Centre d’aide</span><h2>Comment peut-on t’aider?</h2><p>Trouve rapidement une réponse sur tes commandes, les tarifs, les paiements ou ton compte.</p><label className="support-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher dans l’aide…"/></label></div>
  <div className="support-categories">{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>{setCategory(c);setOpen(null)}}>{c}</button>)}</div>
  <div className="support-faq-list">{filtered.map((f,i)=><article className={`support-faq ${open===i?'open':''}`} key={`${f.category}-${f.question}`}><button onClick={()=>setOpen(open===i?null:i)}><span><small>{f.category}</small><strong>{f.question}</strong></span><b>{open===i?'−':'+'}</b></button>{open===i&&<p>{f.answer}</p>}</article>)}{filtered.length===0&&<div className="support-empty">Aucune réponse trouvée. Essaie un autre mot-clé.</div>}</div>
  <div className="support-contact"><div><span className="support-contact-icon">💬</span><div><strong>Tu n’as pas trouvé ta réponse?</strong><p>Garde ton numéro de commande, ton identifiant client et ton NIP du jour à portée de main lorsque tu communiques avec le support.</p></div></div><button onClick={()=>window.location.href='mailto:support@faislajob.ca'}>Contacter le support</button></div>
 </section>
}
