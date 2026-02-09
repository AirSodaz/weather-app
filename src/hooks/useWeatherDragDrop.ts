import { useCallback } from 'react';
import {
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    KeyboardSensor,
    DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { WeatherData } from '../services/weatherApi';

/**
 * Hook to manage drag and drop interactions for weather cards.
 *
 * @param {WeatherData[]} weatherList - The current list of weather data.
 * @param {(oldIndex: number, newIndex: number) => void} reorderCities - Function to reorder cities.
 * @returns {object} The sensors and drag end handler.
 */
export function useWeatherDragDrop(
    weatherList: WeatherData[],
    reorderCities: (oldIndex: number, newIndex: number) => void
) {
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = weatherList.findIndex((w) => w.city === active.id);
            const newIndex = weatherList.findIndex((w) => w.city === over.id);
            reorderCities(oldIndex, newIndex);
        }
    }, [weatherList, reorderCities]);

    return {
        sensors,
        handleDragEnd
    };
}
