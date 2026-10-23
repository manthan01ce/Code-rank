// Original CSS-only fallback; not the licensed React Bits Glitter Warp source.
export default function HomeStarfield(){return <div aria-hidden="true" className="home-starfield">{Array.from({length:32},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,top:`${(i*23)%100}%`,animationDelay:`${i%7}s`}}/>)}</div>;}
