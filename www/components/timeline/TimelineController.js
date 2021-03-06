angular.module('app.controllers')

.controller('TimelineController', function ($scope, storage, socket, $interval, $timeout, $document, $rootScope, $ionicScrollDelegate, $ionicViewSwitcher, $ionicNativeTransitions, $state, $window) {

	$scope.goTo = function () {
		$ionicNativeTransitions.stateGo('timeToLeaveOverview', {}, {
			"type": "slide",
			"direction": "right"
		});
	};

	$scope.floor = Math.floor;
	$scope.keys = Object.keys;
	$scope.editMode = false;
	$scope.editCalendarMode = false;
	$scope.editTransitOption = false;
	$scope.pixelWidthOfOneHour = $window.innerWidth * 0.85 / 4;

	$scope.transitOptions = [
		'car', 'walk', 'subway', 'bicycle', 'cancel'
	];
	// These are the transit options we get from the server. Displaying them is not
	// as consistent as our current options so we translate between the two.
	$scope.transitTranslations = [
		'car', 'walking', 'subway', 'bicycle'
	];

	// Fill up the time line with the hours between 7am and midnight.
	$scope.timerange = [];
	for (var i = 7; i < 24; i++) {
		$scope.timerange.push(i > 12 ? i % 12 : i);
	}
	$scope.timerange.push('');

	$scope.categoryTranslations = {
		work: 'briefcase',
		sports: 'ios-americanfootball',
		leisure: 'ios-game-controller-a'
	}

	$scope.pixelWidthOfTimeline = $window.innerWidth * .85;
	$scope.minimapScrollPosition = 0;

	var widthOfLeftHalfOfTimeline = $window.innerWidth * 0.34;
	var widthOfMinimap = $scope.pixelWidthOfOneHour * $scope.timerange.length - 1;

	$scope.adjustMinimap = function () {
		// Subtract the 'empty' part of the timeline so the alignment works
		// The empty part is 0.85 - 0.5 of the width.
		// Divide that by the value of the whole timeline and multiply it again
		// by the width of the visible timeline.
		$scope.minimapScrollPosition = ($ionicScrollDelegate.getScrollPosition().left - widthOfLeftHalfOfTimeline) / (widthOfMinimap) * 93;
		$scope.$apply();
	};

	var prepareCalendarForTimeline = function () {
		// get the users' carSimulatorData from the storage and listen to updates
		$scope.carSimulatorData = storage.getCarSimulatorData();
		// get the users' calendars from the storage and listen to updates
		$scope.calendars = storage.getCalendars();
		//$scope.scrollToTime(new Date());
		for (var i = 0; i < $scope.calendars.length; i++) {
			for (var j = $scope.calendars[i].events.length - 1; j >= 0; j--) {
				if ($scope.calendars[i].events[j].start.getDay() !== new Date().getDay()) {
					$scope.calendars[i].events.splice(j, 1);
				}
			}
		}
		addDurationAndDistanceToEvents();
	};

	$scope.scrollToTime = function (time) {
		$ionicScrollDelegate.scrollTo((time.getHours() - 7) * $scope.pixelWidthOfOneHour + time.getMinutes() / 60 * $scope.pixelWidthOfOneHour, 0, true);
	};

	// Continually update the time so we can display it
	var updateTime = $interval(function () {
		if ($scope.carSimulatorData && $scope.carSimulatorData['time']) {
			$scope.currentHour = Math.floor($scope.carSimulatorData['time'] / 3600);
			$scope.currentMinutes = Math.floor($scope.carSimulatorData['time'] / 60 % 60);
		} else {
			$scope.currentHour = new Date().getHours();
			$scope.currentMinutes = new Date().getMinutes();
		}
		if ($scope.currentMinutes < 10) {
			$scope.currentMinutes = '0' + $scope.currentMinutes;
		}
		if (!$scope.scrubTimelineMarker) {
			$scope.scrubMarkerMinute = 0;
			var date = new Date();
			date.setHours($scope.currentHour);
			date.setMinutes($scope.currentMinutes);
			$scope.scrollToTime(date);
		}
		$scope.timelineMarkerPosition = (($scope.currentHour - 7) + Number($scope.currentMinutes) / 60) * 85 / 4;
	}, 300);

	$scope.shouldTransitOptionDisplay = function (event, transitName, calendarEmail) {
		if (!$scope.editTransitOption) {
			return false;
		}
		if ($scope.calendars[$scope.selectedUserIndex].email !== calendarEmail) {
			return false;
		}
		if ($scope.calendars[$scope.selectedUserIndex].events[$scope.selectedCalendarIndex].id !== event.id) {
			return false;
		}
		return true;
	};

	$scope.isPrimaryTransitOption = function (event, transitName) {
		// if($scope.editTransitOption){
		// 	return false;
		// }

		if (event.userSelectedTransitOption && event.userSelectedTransitOption.length > 0) {
			return $scope.transitTranslations[$scope.transitOptions.indexOf(event.userSelectedTransitOption)] === transitName;
		}
		return $scope.transitTranslations[$scope.transitOptions.indexOf(event.optimized_transit.best.name)] === transitName;
	}

	$scope.$on("$ionicView.beforeEnter", function (event, data) {
		prepareCalendarForTimeline();
	});

	var canGoBackToTimeToLeave = false;

	storage.subscribe($scope, prepareCalendarForTimeline);

	$scope.$on("$ionicView.enter", function (event, data) {
		$scope.scrollToTime(new Date());
		$scope.scrubTimelineMarker = false;
		$scope.scrubMarkerMinute = 0;
		$scope.selectedTransitOptionIndex = 0;
		$scope.selectedEvent = 0;

		$timeout(function () {
			$rootScope.toggleEditMode = function () {
				if ($scope.editTransitOption) {
					if ($scope.selectedTransitOptionIndex !== $scope.transitOptions.length - 1) {
						$scope.calendars[$scope.selectedUserIndex].events[$scope.selectedCalendarIndex].userSelectedTransitOption = $scope.transitOptions[
							$scope.transitTranslations.indexOf(
								Object.keys(
									$scope.calendars[$scope.selectedUserIndex].events[$scope.selectedCalendarIndex].transit_options)[$scope.selectedTransitOptionIndex])
							];
						storage.setCalendars($scope.calendars);

						// send data to server
						var data = {
							name: $scope.calendars[$scope.selectedUserIndex].name,
							event: $scope.calendars[$scope.selectedUserIndex].events[$scope.selectedCalendarIndex]
						};
						socket.emit('clock - event updated', data);

						// Stay in selection mode even after selecting
						// $scope.editMode = false;
						// $scope.editCalendarMode = false;
					}
					$scope.editTransitOption = false;
					$scope.selectEventMode = false;
					$scope.selectedTransitOptionIndex;
					var timelineMarkerDate = new Date();
					timelineMarkerDate.setMinutes(Number($scope.currentMinutes) + $scope.scrubMarkerMinute);
					$scope.scrollToTime(timelineMarkerDate);
				} else if ($scope.selectEventMode) {
					$scope.selectedTransitOptionIndex = 0;
					$scope.editTransitOption = true;
					$scope.scrollToTime($scope.calendars[$scope.selectedUserIndex].events[$scope.selectedCalendarIndex].start);
				} else {
					// Find all events that coincide with the selected time
					var timelineMarkerDate = new Date();
					timelineMarkerDate.setMinutes(Number($scope.currentMinutes) + $scope.scrubMarkerMinute);
					$scope.selectableEvents = [];
					for (var i = 0; i < $scope.calendars.length; i++) {
						for (var j = 0; j < $scope.calendars[i].events.length; j++) {
							if (timelineMarkerDate.getTime() > $scope.calendars[i].events[j].start && timelineMarkerDate.getTime() < $scope.calendars[i].events[j].end) {
								$scope.selectableEvents.push([i, j]);
							}
						}
					}
					if ($scope.selectableEvents.length > 0) {
						$scope.selectEventMode = true;
						$scope.selectedEvent = 0;
						$scope.selectedUserIndex = $scope.selectableEvents[0][0];
						$scope.selectedCalendarIndex = $scope.selectableEvents[0][1];
					}
				}
			};

			$rootScope.handleClockwise = function () {
				if ($scope.editTransitOption) {
					$scope.selectedTransitOptionIndex = $scope.selectedTransitOptionIndex < $scope.transitOptions.length - 1 ? $scope.selectedTransitOptionIndex + 1 : $scope.selectedTransitOptionIndex;
				} else if ($scope.selectEventMode) {
					if ($scope.selectedEvent < $scope.selectableEvents.length - 1) {
						$scope.selectedEvent++;
						$scope.selectedUserIndex = $scope.selectableEvents[$scope.selectedEvent][0];
						$scope.selectedCalendarIndex = $scope.selectableEvents[$scope.selectedEvent][1];
					}
				} else {
					canGoBackToTimeToLeave = false;
					$scope.scrubTimelineMarker = true;
					$scope.scrubMarkerMinute += 30;
					var date = new Date();
					date.setMinutes(Number($scope.currentMinutes) + $scope.scrubMarkerMinute);
					if(date.getHours() === 23 && date.getMinutes() > 30){
						$scope.scrubMarkerMinute -= 30;
					} else {
						$scope.scrollToTime(date);
					}
				}
			};

			$rootScope.handleCounterClockwise = function () {
				if ($scope.editTransitOption) {
					if ($scope.selectedTransitOptionIndex > 0) {
						$scope.selectedTransitOptionIndex--;
					}
				} else if ($scope.selectEventMode) {
					if ($scope.selectedEvent > 0) {
						$scope.selectedEvent--;
						$scope.selectedUserIndex = $scope.selectableEvents[$scope.selectedEvent][0];
						$scope.selectedCalendarIndex = $scope.selectableEvents[$scope.selectedEvent][1];
					}
				} else {
					if ($ionicScrollDelegate.getScrollPosition().left === 0 && canGoBackToTimeToLeave) {
						$ionicNativeTransitions.stateGo('timeToLeaveOverview', {}, {
							"type": "slide",
							"direction": "right"
						});
					} else {
						$scope.scrubTimelineMarker = true;
						$scope.scrubMarkerMinute -= 30;
						var date = new Date();
						date.setMinutes(Number($scope.currentMinutes) + $scope.scrubMarkerMinute);
						if(date.getHours() < 7 && !canGoBackToTimeToLeave){
							$timeout(function(){
								canGoBackToTimeToLeave = true;
							}, 1000);
						}
						$scope.scrollToTime(date);
					}
				}
			};
		}, 1000);
	});

	$scope.$on("$ionicView.leave", function (event, data) {
		$interval.cancel(updateTime);
		$rootScope.handleClockwise = function () {};
		$rootScope.handleCounterClockwise = function () {};
		$rootScope.toggleEditMode = function () {};
	});

	var addDurationAndDistanceToEvents = function () {
		for (var i = 0; i < $scope.calendars.length; i++) {
			for (var j = 0; j < $scope.calendars[i].events.length; j++) {
				var event = $scope.calendars[i].events[j];
				if (j === 0) {
					$scope.calendars[i].events[j].distanceToEventBeforeInMinutes = event.start.getHours() * 60 + event.start.getMinutes() - 7 * 60;
				} else {
					var eventBefore = $scope.calendars[i].events[j - 1];
					$scope.calendars[i].events[j].distanceToEventBeforeInMinutes =
						event.start.getHours() * 60 + event.start.getMinutes() -
						(eventBefore.end.getHours() * 60 + eventBefore.end.getMinutes());
				}
				$scope.calendars[i].events[j].durationInMinutes =
					event.end.getHours() * 60 + event.end.getMinutes() -
					(event.start.getHours() * 60 + event.start.getMinutes());
			}
		}
	};
});