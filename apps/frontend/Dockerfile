# 1. Usar una imagen oficial de Node.js ligera (Alpine)
FROM node:18-alpine

# 2. Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# 3. Copiar solo los archivos de dependencias primero
# Esto aprovecha la caché de Docker: si no cambias el package.json, 
# Docker no volverá a descargar todo npm install en futuras construcciones
COPY package.json package-lock.json* ./

# 4. Instalar las dependencias de Node
RUN npm install

# 5. Copiar el resto del código fuente del frontend
COPY . .

# 6. Exponer el puerto por defecto de Vite
EXPOSE 5173

# 7. Comando para arrancar el servidor de desarrollo
# El "--host" es obligatorio en Docker para que Vite escuche peticiones externas
CMD ["npm", "run", "dev", "--", "--host"]