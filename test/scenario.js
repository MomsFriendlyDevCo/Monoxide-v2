module.exports = {
	// Users {{{
	users: [
		{
			_ref: 'users.joe',
			name: 'Joe Random',
			status: 'active',
			company: 'company.acme',
			role: 'user',
			favourite: {
				color: 'red',
				animal: 'dog',
			},
			_password: 'ue', // INPUT: flume
		},
		{
			_ref: 'users.jane',
			name: 'Jane Quark',
			status: 'active',
			company: 'company.acme',
			role: 'user',
			favourite: {
				color: 'yellow',
				animal: 'cat',
			},
			_password: 'oeaeoeae', // INPUT: correct battery horse staple
		},
		{
			_ref: 'users.bob',
			name: 'Bob Bobart',
			status: 'unverified',
			company: 'company.acme',
			role: 'user',
			favourite: {
				color: 'yellow',
				animal: 'dog',
			},
			_password: 'ao', // INPUT: password
		},
		{
			_ref: 'users.dick',
			name: 'Dick deleteed',
			status: 'deleted',
			company: 'company.aperture',
			role: 'user',
			favourite: {
				color: 'blue',
				animal: 'squirrel',
			},
			_password: 'ao', // INPUT: password
		},
		{
			_ref: 'users.vallery',
			name: 'Vallery Unverrifed',
			status: 'unverified',
			company: 'company.aperture',
			role: 'user',
			favourite: {
				color: 'blue',
				animal: 'dog',
			},
			_password: 'ao', // INPUT: password
		},
		{
			_ref: 'users.don',
			name: 'Don Delete',
			status: 'deleted',
			company: 'company.acme',
			role: 'user',
			favourite: {
				color: 'red',
				animal: 'dog',
			},
			_password: 'ao', // INPUT: password
		},
		{
			_ref: 'users.adam',
			name: 'Adam Admin',
			status: 'active',
			company: 'company.acme',
			role: 'admin',
			favourite: {
				color: 'red',
				animal: 'dog',
			},
			_password: 'ao', // INPUT: password
		},
	],
	// }}}
	// Companies {{{
	companies: [
		{
			_ref: 'company.acme',
			name: 'Acme Inc',
		},
		{
			_ref: 'company.aperture',
			name: 'Aperture Science',
		},
		{
			_ref: 'company.empty',
			name: 'Empty Box Incoporated',
		},
	],
	// }}}
	// Widgets {{{
	widgets: [
		{
			_ref: 'widget-crash',
			created: '2016-06-23T10:23:42Z',
			name: 'Widget crash',
			content: 'This is the crash widget',
			featured: true,
			// color: 'blue', // Should default to this via schema
		},
		{
			_ref: 'widget-bang',
			created: '2016-01-27T19:17:04Z',
			name: 'Widget bang',
			content: 'This is the bang widget',
			color: 'red',
		},
		{
			_ref: 'widget-whollop',
			created: '2016-03-19T17:43:21',
			name: 'Widget whollop',
			content: 'This is the whollop widget',
			color: 'blue',
		}
	],
	// }}}
};
