import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { mapToMapExpression } from '@angular/compiler/src/render3/util';
import { Lugar } from '../interfaces/lugar';
import { HttpClient } from '@angular/common/http';
import { WebsocketService } from '../services/websocket.service';

@Component({
	selector: 'app-mapa',
	templateUrl: './mapa.component.html',
	styleUrls: ['./mapa.component.css']
})
export class MapaComponent implements OnInit {
	@ViewChild('map') mapaElement: ElementRef;
	map: google.maps.Map;
	marcadores: google.maps.Marker[] = [];
	infoWindows: google.maps.InfoWindow[] = []; // (*) Creo un array de infowindows

	lugares: Lugar[] = [];

	constructor(private http: HttpClient, private wsService: WebsocketService) { }

	ngOnInit() {
		this.cargarMarcadores();
		this.escucharSockets();
	}

	escucharSockets() {
		// Escucho un marcador nuevo
		this.wsService.listen('marcador-nuevo').subscribe((data: any) => {
			this.agregarMarcador(data);
			console.log('Marcador Nuevo: ', data);
		});
		// marcador mover
		this.wsService.listen('marcador-mover').subscribe((marcador: Lugar) => {
			this.moverMarcador(marcador);
		});
		// marcador borrar
		this.wsService.listen('marcador-borrar').subscribe((id: string) => {
			this.borrarMarcador(id);
		});
	}

	borrarMarcador(id: string) {
		for (const i in this.marcadores) {
			if (this.marcadores[i].getTitle() === id) {
				console.log('marcador detectado', this.marcadores[i]);
				this.marcadores[i].setMap(null);
				break;
			}
		}
	}

	moverMarcador(marcador: Lugar) {
		for (const i in this.marcadores) {
			if (this.marcadores[i].getTitle() === marcador.id) {
				console.log('marcador detectado', this.marcadores[i]);

				const latLng = new google.maps.LatLng(marcador.lat, marcador.lng);
				// this.marcadores[i].setPosition(latLng);
				this.marcadores[i].setPosition(marcador);
				console.log(marcador);
				break;
			}
		}
	}

	cargarMarcadores() {
		this.http.get('http://localhost:5000/mapa').subscribe((lugares: Lugar[]) => {
			// this.lugares.push(...lugares);
			this.lugares = lugares;
			this.cargarMapa();
		});
	}

	cargarMapa() {
		const latLng = new google.maps.LatLng(37.784679, -122.395936);
		const mapaOpciones: google.maps.MapOptions = {
			center: latLng,
			zoom: 13,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		};
		this.map = new google.maps.Map(this.mapaElement.nativeElement, mapaOpciones);
		// con la referencia a la instacia del mapa (this.map) vamos a crear un listener
		// El addListener es un listener al mapa, a diferencia del addOnListener que usamos antes
		// que era un listener para algo que esta dentro del objeto del mapa
		this.map.addListener('click', (coors) => {
			const nuevoMarcador: Lugar = {
				nombre: 'Nuevo Lugar',
				lat: coors.latLng.lat(),
				lng: coors.latLng.lng(),
				id: new Date().toISOString() // sólo para obtener un id único
			};
			this.agregarMarcador(nuevoMarcador);
			// Emitir evento de socket, agregar marcador
			this.wsService.emit('marcador-nuevo', nuevoMarcador);
		});

		for (const lugar of this.lugares) {
			console.log('Marcador for', lugar);
			this.agregarMarcador(lugar);
		}
	}

	agregarMarcador(marcador: Lugar) {
		console.log('Agregando Marcador', marcador);
		const latLng = new google.maps.LatLng(marcador.lat, marcador.lng);
		// definimos las opicones en tiempo de ejecución mandandole un objeto literal
		const marker = new google.maps.Marker({
			map: this.map,
			animation: google.maps.Animation.DROP,
			position: latLng,
			draggable: true,
			title: marcador.id // (**)
		});
		// Referencia a los marcadores
		this.marcadores.push(marker);

		// Vamos a tener que tener SIEMPRE una referencia a "marker" porque cuando queramos
		// actualizar o borrar ese marcador vamos a necesitar una referencia a ESE marcador.
		// para eso creamos la propiedad marcadores: google.maps.Marker[] = [];
		// es un arreglo de marcadores con la ventaja de que en JS todo se pasa por referencia.
		// Entonces voy a tener la referencia local o el puntero a el objeto marker.
		// Para el infowindow es mas complicado primero hay que crear un elemento.
		const contenido = `<b>${marcador.nombre}</b>`;
		const infowindow = new google.maps.InfoWindow({
			content: contenido
		});
		this.infoWindows.push(infowindow); // (*)

		// CREAR MARCADOR
		// hago un attach de un listener al elemento marker para mostrar un infowindow con un click
		google.maps.event.addDomListener(marker, 'click', (coors) => {
			// console.log(coors);
			for (const info of this.infoWindows) {
				info.close();
				// también podría usar
				// this.infoWindows.foreach(infow => {
				// });
			}
			infowindow.open(this.map, marker);
			// para que al abrir un infowindow en un marker se cierren los demas infowindow -> (*)
			// disparar un evento de socket, mostrar un infowindow.
		});

		// BORRAR MARCADOR
		// hago un attach de un listener al elemento marker para borrarlo con un doble click
		google.maps.event.addDomListener(marker, 'dblclick', (coors) => {
			// console.log(coors);
			marker.setMap(null);
			// disparar un evento de socket, para borrar el marcador.
			this.wsService.emit('marcador-borrar', marcador.id);
		});

		// MOVER MARCADOR
		// hago un attach de un listener al elemento marker para moverlo con un drag
		google.maps.event.addDomListener(marker, 'drag', (coors) => {
			const nuevoMarcador = {
				id: marcador.id, // podría también obtener el ID con marker.getTitle() (**)
				lat: coors.latLng.lat(),
				lng: coors.latLng.lng(),
				nombre: marcador.nombre
			};
			// disparar un evento de socket, para mover el marcador.
			this.wsService.emit('marcador-mover', nuevoMarcador);
		});
	}
}
